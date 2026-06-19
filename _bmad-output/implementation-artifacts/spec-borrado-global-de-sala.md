---
title: 'Borrado global de sala'
type: 'feature'
created: '2026-06-18'
status: 'done'
baseline_commit: '413c2b39c4bd0556cad04539e41060b15ef0f6d1'
context:
  - '{project-root}/docs/SPEC.md'
  - '{project-root}/docs/development-standard.md'
  - '{project-root}/docs/production-readiness.md'
---

<frozen-after-approval reason="human-owned intent — do not modify unless human renegotiates">

## Intent

**Problem:** El control “🔥 borrar todo · salir” solo borra los mensajes del estado React del dispositivo que lo pulsa y elimina únicamente a ese miembro. Los mensajes persistidos, los demás miembros y sus sesiones continúan activos.

**Approach:** Convertir la triple confirmación en un borrado global de la sala actual. El servidor eliminará atómicamente la sala y todos sus datos asociados, notificará a todos los sockets conectados y los desconectará; cada cliente limpiará sus datos locales persistentes y volverá inmediatamente a la calculadora.

**Additional requirement:** El aviso de limpieza del instalador debe reconocer y mencionar el nombre real generado por EAS (`application-*.apk`), sin limitarse a nombres históricos.

## Boundaries & Constraints

**Always:** Mantener la triple confirmación existente. Borrar la fila de sala para aprovechar `ON DELETE CASCADE` sobre miembros, mensajes, eventos de ubicación y alertas rápidas. Eliminar del dispositivo todo dato persistente propiedad de FRÍA conocido actualmente: token push, indicador de limpieza y crash log; además vaciar mensajes, miembros, ubicaciones y codename en memoria. Notificar a todos los clientes antes de desconectarlos. Permitir que `fria-001` se recree vacía en el siguiente ingreso.

**Ask First:** Cambiar la triple confirmación, añadir autenticación/autorización o impedir que cualquier miembro conectado pueda ejecutar el borrado global.

**Never:** Borrar otras salas; borrar datos fuera del almacenamiento propio de FRÍA; cambiar EAS, credenciales, variables de entorno, esquema SQL o migraciones; dejar clientes conectados después del borrado.

## I/O & Edge-Case Matrix

| Scenario | Input / State | Expected Output / Behavior | Error Handling |
|----------|--------------|---------------------------|----------------|
| Borrado con varios miembros | Un miembro completa 3 pulsaciones | Sala y datos asociados desaparecen; todos reciben `room_purged`, limpian estado local y vuelven a calculadora | El servidor registra el error y no emite éxito si la eliminación falla |
| Cliente iniciador | Emite borrado global | Espera confirmación del servidor; recibe el mismo evento que los demás | No desconectar localmente antes de que el servidor procese la solicitud |
| Datos locales | Cliente recibe `room_purged` | SecureStore y todo estado de sesión quedan vacíos | Fallos de SecureStore no impiden regresar a la calculadora |
| Sala inexistente o ya borrada | Llega una solicitud repetida | Resultado idempotente; todos los sockets conocidos se expulsan | No recrear la sala durante el borrado |

</frozen-after-approval>

## Code Map

- `app/src/screens/FriaScreen.tsx` -- triple confirmación y disparo del borrado.
- `app/src/hooks/useSocket.ts` -- evento cliente `purge_room`, recepción de `room_purged` y limpieza del estado de sesión.
- `app/App.tsx` -- transición global a calculadora al recibir expulsión por borrado.
- `app/src/push.ts`, `app/src/cleanup.ts`, `app/src/ErrorBoundary.tsx` -- claves SecureStore que deben eliminarse mediante una única función local.
- `server/index.js` -- coordinación del borrado, broadcast y desconexión de todos los sockets de la sala.
- `server/src/store/memory.js` -- eliminación total idempotente para desarrollo y pruebas.
- `server/src/store/pg.js` -- `DELETE FROM rooms` transaccional con cascada.
- `server/test/memory-store.test.js`, `server/test/socket-protocol.test.js` -- cobertura de persistencia y expulsión multiusuario.

## Tasks & Acceptance

**Execution:**
- [x] `app/src/localData.ts` -- centralizar la eliminación best-effort de todas las claves SecureStore propias de FRÍA.
- [x] `app/src/cleanup.ts`, `app/test/cleanup.test.ts` -- adaptar detección y texto del instalador al patrón real `application-*.apk`.
- [x] `app/src/hooks/useSocket.ts`, `app/App.tsx`, `app/src/screens/FriaScreen.tsx` -- reemplazar el borrado local/leave por solicitud global y manejar `room_purged` limpiando todo el estado y regresando a calculadora.
- [x] `server/src/store/memory.js`, `server/src/store/pg.js` -- añadir eliminación total e idempotente de una sala.
- [x] `server/index.js` -- procesar `purge_room`, borrar primero, emitir `room_purged` y desconectar todos los sockets afectados sin ejecutar `markInactive`.
- [x] `server/test/memory-store.test.js`, `server/test/socket-protocol.test.js`, pruebas app relevantes -- verificar cascada lógica, expulsión de todos y limpieza local.
- [x] `docs/SPEC.md` -- actualizar el contrato de borrado destructivo.

**Acceptance Criteria:**
- Given dos o más clientes dentro de `fria-001`, when cualquiera completa la triple confirmación, then todos vuelven a la calculadora y quedan desconectados.
- Given mensajes, miembros y ubicaciones existentes, when se procesa el borrado, then una unión posterior recibe historial vacío, roster nuevo y ningún dato anterior.
- Given datos FRÍA en SecureStore, when un cliente recibe `room_purged`, then todas las claves conocidas se eliminan aunque otro cliente haya iniciado el borrado.
- Given un error de base de datos, when se solicita el borrado, then el servidor no comunica éxito ni expulsa a los demás como si los datos hubieran sido eliminados.

## Design Notes

El evento de éxito debe emitirse únicamente después de que `store.purgeRoom(roomId)` termine. El servidor marca todos los sockets de la sala como salida definitiva, emite `room_purged`, elimina sus entradas de `liveSockets` y después desconecta. Así los handlers `disconnect` no recrean miembros offline mediante `markInactive`.

## Verification

**Commands:**
- `cd server && npm test` -- expected: pruebas de store y protocolo Socket.IO pasan.
- `cd app && npm run type-check && npm test -- --runInBand` -- expected: TypeScript y pruebas app pasan.

## Suggested Review Order

**Contrato destructivo**

- Borra primero, notifica éxito y desconecta todos los sockets de la sala.
  [`index.js:174`](../../server/index.js#L174)

- PostgreSQL elimina la raíz y delega la cascada al esquema existente.
  [`pg.js:95`](../../server/src/store/pg.js#L95)

- El store en memoria conserva semántica idempotente equivalente.
  [`memory.js:112`](../../server/src/store/memory.js#L112)

**Reacción del cliente**

- Todos los clientes vacían sesión y activan el retorno global.
  [`useSocket.ts:133`](../../app/src/hooks/useSocket.ts#L133)

- La triple confirmación espera la respuesta real del servidor.
  [`App.tsx:62`](../../app/App.tsx#L62)

- SecureStore elimina todas las claves privadas conocidas de FRÍA.
  [`localData.ts:9`](../../app/src/localData.ts#L9)

**Instalador y pruebas**

- El aviso reconoce explícitamente los APK `application-*.apk` de EAS.
  [`cleanup.ts:17`](../../app/src/cleanup.ts#L17)

- La prueba multiusuario verifica borrado, expulsión y reingreso vacío.
  [`socket-protocol.test.js:374`](../../server/test/socket-protocol.test.js#L374)
