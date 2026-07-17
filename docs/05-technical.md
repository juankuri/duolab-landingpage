# Flow

## Public

Patient -> Landing -> Find Record -> Record Details -> Download File

## Inside

Login > Dashboard > Create / Open Record > Upload PDF > Preview > > Confirm

Open Record > Review PDFs > Preview > Publish Done

# API

## Endpoints

POST /records

POST /records/{id}/files

POST /files/{id}/confirm

GET /records/{id}

## Contract

POST /records

Request

{
  fullName
  birthDate
  phone
  folio
}

Response

201

{
  recordId
}