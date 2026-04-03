# Nova Backend (Privacy-First Menstrual Health Tracker)

Spring Boot 3 backend for Nova using Java 21, Maven, MySQL, JWT authentication, and encrypted blob storage.

## Privacy Model

- Sensitive cycle and symptom content is stored only as encrypted bytes (`LONGBLOB`).
- The backend does not persist plaintext cycle details.
- Clients must encrypt data before sending and decrypt after retrieving.

## Tech Stack

- Java 21
- Spring Boot 3
- Spring Security (JWT)
- Spring Data JPA
- MySQL 8
- ONNX Runtime (Java)

## Run Locally

### 1. Environment variables

```bash
DB_HOST=localhost
DB_PORT=3306
DB_NAME=nova
DB_USERNAME=nova
DB_PASSWORD=nova_pass
JWT_SECRET=replace-with-at-least-32-char-secret
JWT_EXPIRATION_MS=86400000
```

### 2. Start MySQL + app using Docker Compose

From the workspace root:

```bash
docker compose up --build
```

### 3. Start app directly (optional)

From the `backend` folder:

```bash
./mvnw spring-boot:run
```

## REST API

Base URL: `http://localhost:8080`

### Health

#### GET /api/health (public)

Response:

```json
{
  "status": "UP",
  "service": "nova-backend"
}
```

### Authentication

#### POST /api/auth/register (public)

Request:

```json
{
  "email": "user@nova.app",
  "password": "StrongPass123"
}
```

Response (201):

```json
{
  "token": "<JWT_TOKEN>"
}
```

#### POST /api/auth/login (public)

Request:

```json
{
  "email": "user@nova.app",
  "password": "StrongPass123"
}
```

Response (200):

```json
{
  "token": "<JWT_TOKEN>"
}
```

### Cycle Logs (Encrypted)

Authentication header required:

```http
Authorization: Bearer <JWT_TOKEN>
```

#### POST /api/cycles

Request:

```json
{
  "encryptedData": "QmFzZTY0RW5jcnlwdGVkQmxvYg==",
  "dataType": "CYCLE"
}
```

Response (201):

```json
{
  "id": "a2bc49b1-58d9-4f37-a7f5-0ea335f8f07a",
  "userId": "956dd8f8-ef89-43e3-a986-55a7c758ae31",
  "encryptedData": "QmFzZTY0RW5jcnlwdGVkQmxvYg==",
  "timestamp": "2026-04-04T10:21:34.942999Z",
  "dataType": "CYCLE"
}
```

#### GET /api/cycles/{userId}

Response (200):

```json
[
  {
    "id": "a2bc49b1-58d9-4f37-a7f5-0ea335f8f07a",
    "userId": "956dd8f8-ef89-43e3-a986-55a7c758ae31",
    "encryptedData": "QmFzZTY0RW5jcnlwdGVkQmxvYg==",
    "timestamp": "2026-04-04T10:21:34.942999Z",
    "dataType": "CYCLE"
  }
]
```

#### DELETE /api/cycles/{id}

Response (204): no content

### Prediction (ONNX)

#### POST /api/predictions/run

Request:

```json
{
  "inputData": "AQIDBAUG"
}
```

Response (200):

```json
{
  "predictedDate": "2026-05-02",
  "confidenceRange": "0.67 - 0.77"
}
```

## Error Format

All handled errors return:

```json
{
  "timestamp": "2026-04-04T10:31:12.332Z",
  "status": 400,
  "error": "Bad Request",
  "message": "encryptedData must be valid Base64."
}
```

## ONNX Model Notes

- The model is loaded from `src/main/resources/models/cycle_model.onnx`.
- Replace the placeholder file with your real ONNX binary model.
- Method: `PredictionService.runInference(byte[] inputData)`.
