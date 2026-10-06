# Diagrama entidad-relación — TruequeUTN

Modelo de datos inicial (TEC-02). La fuente de verdad es [`server/prisma/schema.prisma`](../server/prisma/schema.prisma); si cambia el schema, actualizar este diagrama en el mismo PR.

GitHub renderiza el diagrama automáticamente. En VS Code se puede ver con la extensión _Markdown Preview Mermaid Support_.

```mermaid
erDiagram
    User ||--o{ Item : "publica"
    User ||--o{ Proposal : "envía (proponente)"
    User ||--o{ Proposal : "recibe (receptor)"
    Item ||--o{ Proposal : "es solicitado en"
    Item ||--o{ Proposal : "es ofrecido en"
    Proposal ||--o{ Rating : "recibe hasta 2"
    User ||--o{ Rating : "califica (evaluador)"
    User ||--o{ Rating : "es calificado (evaluado)"

    User {
        int id PK
        string nombre
        string email UK
        string passwordHash
        string carrera
        datetime createdAt
    }

    Item {
        int id PK
        string titulo
        string descripcion "opcional"
        Categoria categoria
        EstadoConservacion estadoConservacion
        string materia "opcional"
        string fotoUrl "opcional"
        EstadoItem estado "default DISPONIBLE"
        int ownerId FK
        datetime createdAt
        datetime updatedAt
    }

    Proposal {
        int id PK
        int itemSolicitadoId FK
        int itemOfrecidoId FK
        int proponenteId FK
        int receptorId FK
        string mensaje "opcional"
        EstadoPropuesta estado "default PENDIENTE"
        datetime createdAt
        datetime updatedAt
    }

    Rating {
        int id PK
        int proposalId FK
        int evaluadorId FK
        int evaluadoId FK
        int puntaje "1 a 5 (CHECK)"
        string comentario "opcional"
        datetime createdAt
    }
```

## Enums

| Enum                 | Valores                                               |
| -------------------- | ----------------------------------------------------- |
| `Categoria`          | LIBRO, APUNTE, CALCULADORA, INSTRUMENTAL, OTRO        |
| `EstadoConservacion` | NUEVO, BUENO, USADO                                   |
| `EstadoItem`         | DISPONIBLE, RESERVADO, INTERCAMBIADO, PAUSADO         |
| `EstadoPropuesta`    | PENDIENTE, ACEPTADA, RECHAZADA, CANCELADA, CONCRETADA |

## Restricciones relevantes

- `User.email` es único.
- `Rating` es único por (`proposalId`, `evaluadorId`): cada participante califica una sola vez por intercambio.
- `Rating.puntaje` tiene un `CHECK` entre 1 y 5, agregado a mano en la migración inicial porque Prisma no lo soporta en el schema.
- Todas las claves foráneas usan `ON DELETE RESTRICT`: no se puede borrar un usuario o ítem que tenga propuestas o calificaciones asociadas (por eso HU-15 plantea borrado lógico).
