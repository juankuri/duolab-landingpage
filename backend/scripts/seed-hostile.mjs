/**
 * Seeds data that is deliberately ugly, on purpose — the counterpart to
 * seed.mjs's clean walkthrough data. Every screen this pass touches is
 * reviewed against what this script creates, not against seed.mjs's
 * demo-friendly names (docs/09-ux-completion-plan.md §C3): a 120-character
 * name, a single unbroken 60-character word, a patient with 40 folios, a
 * folio with 15 results, a 200-character filename, and empty-but-valid
 * optional values wherever the API allows them.
 *
 * Same shape as seed.mjs: talks to a RUNNING `wrangler dev`, not to D1
 * directly, for the same DEC-009 consistency reason (a `files` row needs its
 * R2 object, and only the real endpoints keep the two in step). Idempotent
 * the same way — folios are unique, a second run reports "already there"
 * rather than erroring.
 *
 * Usage:
 *   pnpm --filter @duolab/backend dev:setup
 *   pnpm --filter @duolab/backend dev          # in another terminal
 *   pnpm --filter @duolab/backend dev:seed-hostile
 */

const API = process.env.SEED_API_BASE ?? "http://localhost:8787";

const PDF_BYTES = new TextEncoder().encode(
  "%PDF-1.4\n1 0 obj<</Type/Catalog>>endobj\ntrailer<</Root 1 0 R>>\n%%EOF\n",
);

const pdf = (name) => new File([PDF_BYTES], name, { type: "application/pdf" });

let created = 0;
let skipped = 0;

async function api(path, init) {
  const response = await fetch(`${API}${path}`, init);
  const payload = await response.json().catch(() => ({}));
  return { ok: response.ok, status: response.status, payload };
}

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

async function main() {
  const health = await fetch(`${API}/health`).catch(() => null);

  if (!health?.ok) {
    console.error(
      `No hay API en ${API}.\n` +
        `Levanta el Worker primero:  pnpm --filter @duolab/backend dev`,
    );
    process.exit(1);
  }

  console.log(`API en ${API}\n`);
  console.log("Datos hostiles:\n");

  // A 120-character name, right at validateFullName's upper bound (120)
  // (backend/src/domain/validation.ts) — every truncation rule this pass
  // adds is meant to survive exactly this without clipping into an ellipsis
  // that hides where the name actually ends.
  const longName =
    "Guadalupe Concepción Xóchitl del Rosario Villaseñor Etchegaray Montemayor de la Peña y Quintanilla";
  await createFolio({
    fullName: longName.slice(0, 120),
    birthDate: "1965-07-22",
    phoneNumber: "9384440004",
    folio: "GCVE-220765-01",
  });

  // One unbroken 60-character word — no space for a line break to land on,
  // which is what actually stresses `.truncate`/`.clamp-2` rather than a
  // long name that merely has many words.
  const oneWord = "A".repeat(58) + "Bc"; // 60 chars, passes /\p{L}/u, no spaces
  await createFolio({
    fullName: oneWord,
    birthDate: "1970-01-01",
    phoneNumber: "9385550005",
    folio: "AAAA-010170-01",
  });

  // A 200-character filename (well past what any card or row was designed
  // assuming) on an otherwise ordinary patient.
  const longFilenamePatient = await createFolio({
    fullName: "Paciente Con Archivo Largo",
    birthDate: "1988-09-09",
    phoneNumber: "9386660006",
    folio: "PCAL-090988-01",
    file: pdf(`resultado-${"x".repeat(180)}.pdf`),
  });
  void longFilenamePatient;

  // A patient with 40 folios — the long-list case: any list capped at ~20
  // rows with a "mostrando N de 40" count has to actually show up here.
  console.log("\n  Paciente con 40 folios (para las listas largas):");
  const manyFolios = await createFolio({
    fullName: "Roberto Manuel Sáenz Cordero",
    birthDate: "1980-04-18",
    phoneNumber: "9387770007",
    folio: "RMSC-180480-01",
  });

  if (manyFolios) {
    for (let n = 2; n <= 40; n++) {
      const seq = String(n).padStart(2, "0");
      await createFolio({ patientId: manyFolios.patientId, folio: `RMSC-180480-${seq}` });
    }
  }

  // A folio with 15 results — the per-folio result list's long-list case,
  // distinct from the per-patient one above.
  console.log("\n  Folio con 15 resultados:");
  const manyResults = await createFolio({
    fullName: "Consuelo Fabiola Reyes Montoya",
    birthDate: "1975-12-25",
    phoneNumber: "9388880008",
    folio: "CFRM-251275-01",
  });

  if (manyResults) {
    for (let n = 2; n <= 15; n++) {
      await addResult(manyResults.recordId, `resultado-${n}.pdf`);
    }
  }

  console.log(`\n${created} folios creados, ${skipped} ya existían.`);
  console.log(
    "\nRevisa contra estos datos, no contra dev:seed:\n" +
      "  /admin/buscar → 'Guadalupe' y el nombre de una sola palabra de 60 caracteres\n" +
      "  /admin/paciente?id=<id de Roberto> → 40 folios\n" +
      "  /admin/folio?f=CFRM-251275-01 → 15 resultados\n" +
      "  /admin/folio?f=PCAL-090988-01 → nombre de archivo de 200 caracteres",
  );
}

main().catch((error) => {
  console.error(`\nFalló la siembra hostil: ${error.message}`);
  process.exit(1);
});
