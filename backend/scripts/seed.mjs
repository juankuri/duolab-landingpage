/**
 * Seeds the local database with data worth walking a QA script over.
 *
 * Deliberately talks to a RUNNING `wrangler dev`, not to D1 directly. A SQL
 * seed would insert `files` rows without their R2 objects — precisely the
 * inconsistent state DEC-009 exists to make unreachable — and every preview
 * in the resulting UI would fail because of the seed rather than because of
 * the code. Going through the real endpoints keeps D1 and R2 in step and
 * exercises the same paths an employee does.
 *
 * Publishing and revoking need a manager. The local Access bypass takes its
 * role from DEV_ROLE in backend/.dev.vars and cannot be overridden per
 * request, so this script seeds as far as the current role allows and says
 * plainly what it skipped rather than pretending it succeeded.
 *
 * Idempotency: folios are unique, so a second run 409s on every folio it
 * already created. That is reported as "already there" and is not an error —
 * re-running to top up after a wipe is a normal thing to do.
 *
 * Usage:
 *   pnpm --filter @duolab/backend dev:setup     # migrations first
 *   pnpm --filter @duolab/backend dev           # in another terminal
 *   pnpm --filter @duolab/backend dev:seed
 */

const API = process.env.SEED_API_BASE ?? "http://localhost:8787";

/** Smallest byte sequence that is a real PDF and passes the magic-byte check. */
const PDF_BYTES = new TextEncoder().encode(
  "%PDF-1.4\n1 0 obj<</Type/Catalog>>endobj\ntrailer<</Root 1 0 R>>\n%%EOF\n",
);

const pdf = (name) => new File([PDF_BYTES], name, { type: "application/pdf" });

let created = 0;
let skipped = 0;
const notes = [];

async function api(path, init) {
  const response = await fetch(`${API}${path}`, init);
  const payload = await response.json().catch(() => ({}));

  return { ok: response.ok, status: response.status, payload };
}

/** Creates a patient + folio + first result. Returns null if the folio exists. */
async function createFolio({ patientId, fullName, birthDate, phoneNumber, folio, file }) {
  const form = new FormData();

  if (patientId) {
    form.set("patientId", patientId);
  } else {
    form.set("fullName", fullName);
    form.set("birthDate", birthDate);
    form.set("phoneNumber", phoneNumber);
  }

  form.set("folio", folio);
  form.set("file", file ?? pdf("resultado.pdf"));

  const { ok, status, payload } = await api("/records", { method: "POST", body: form });

  if (status === 409) {
    skipped += 1;
    console.log(`  · ${folio} ya existe, se deja como está`);
    return null;
  }

  if (!ok) {
    throw new Error(`${folio}: ${status} ${JSON.stringify(payload)}`);
  }

  created += 1;
  console.log(`  ✓ ${folio}`);
  return payload;
}

/** Adds a further result to a folio that already has one. */
async function addResult(recordId, name) {
  const form = new FormData();
  form.set("file", pdf(name));

  const { ok, status, payload } = await api(`/records/${recordId}/files`, {
    method: "POST",
    body: form,
  });

  if (!ok) throw new Error(`add ${name}: ${status} ${JSON.stringify(payload)}`);
  return payload;
}

/** Runs a lifecycle action, tolerating the 403 an employee gets on publish. */
async function move(fileId, action) {
  const { ok, status } = await api(`/files/${fileId}/${action}`, { method: "POST" });

  if (status === 403) {
    notes.push(
      `No se pudo ${action} (403): el rol local es EMPLOYEE. ` +
        `Pon DEV_ROLE="manager" en backend/.dev.vars, reinicia wrangler dev y vuelve a sembrar.`,
    );
    return false;
  }

  if (!ok) throw new Error(`${action} ${fileId}: ${status}`);
  return true;
}

async function main() {
  const health = await fetch(`${API}/health`).catch(() => null);

  if (!health?.ok) {
    console.error(
      `No hay API en ${API}.\n` +
        `Levanta el Worker primero:  pnpm --filter @duolab/backend dev`,
    );
    process.exit(1);
  }

  const role = (await api("/me")).payload?.role ?? "?";
  console.log(`API en ${API}, rol local: ${role}\n`);

  console.log("Pacientes y folios:");

  // Accented name: the search box has to find this typing "nunez" as well as
  // "Núñez", which is what patients.search_name and normalizeForSearch() are for.
  const nunez = await createFolio({
    fullName: "María Núñez Beltrán",
    birthDate: "1985-03-14",
    phoneNumber: "9381110001",
    folio: "MANB-140385-01",
  });

  // Same patient, second folio — this is what /admin/paciente and Flow C are
  // for: a returning patient should not be retyped.
  if (nunez) {
    await createFolio({ patientId: nunez.patientId, folio: "MANB-140385-02" });
  }

  const ortiz = await createFolio({
    fullName: "Juan Pablo Ortiz Lara",
    birthDate: "1992-11-02",
    phoneNumber: "9382220002",
    folio: "JPOL-021192-01",
  });

  // The folio the detail screen exists to show: several results, each in its
  // own state at the same time.
  const mixta = await createFolio({
    fullName: "Rosa Elena Chan Pech",
    birthDate: "1978-06-30",
    phoneNumber: "9383330003",
    folio: "RECP-300678-01",
  });

  if (mixta) {
    console.log("\nResultados en varios estados sobre RECP-300678-01:");

    // #1 (from creation) stays a draft.
    const second = await addResult(mixta.recordId, "confirmado.pdf");
    const third = await addResult(mixta.recordId, "revocado.pdf");
    const fourth = await addResult(mixta.recordId, "publicado.pdf");

    await move(second.fileId, "confirm");
    console.log("  ✓ #2 confirmado");

    // Order matters: a folio may hold only one PUBLISHED result at a time
    // (DEC-010), so the one that ends up REVOKED has to be published and
    // pulled back BEFORE the one meant to stay published takes the slot.
    // The other way round, this publish would 409 with ALREADY_PUBLISHED.
    await move(third.fileId, "confirm");
    if (await move(third.fileId, "publish")) {
      if (await move(third.fileId, "revoke")) console.log("  ✓ #3 revocado");
    }

    await move(fourth.fileId, "confirm");
    if (await move(fourth.fileId, "publish")) console.log("  ✓ #4 publicado");
  }

  // Something for the manager queue: confirmed, waiting to be released.
  if (ortiz) {
    await move(ortiz.fileId, "confirm");
    console.log("\n  ✓ JPOL-021192-01 confirmado (cola de publicación)");
  }

  console.log(`\n${created} folios creados, ${skipped} ya existían.`);

  for (const note of new Set(notes)) {
    console.log(`\n⚠ ${note}`);
  }

  console.log(
    "\nPara el recorrido de QA (docs/06-quality.md):\n" +
      "  http://localhost:4321/admin\n" +
      "  Consulta pública: folio RECP-300678-01 · tel 9383330003 · nac. 1978-06-30",
  );
}

main().catch((error) => {
  console.error(`\nFalló la siembra: ${error.message}`);
  process.exit(1);
});
