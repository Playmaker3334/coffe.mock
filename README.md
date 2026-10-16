# Cafetería · sitio + panel de administración (demo)

Sitio público de una cafetería (base: [coffe.mock](https://github.com/Playmaker3334/coffe.mock)) más un panel
de administración en `/admin` con la lógica de negocio de un punto de venta real en producción
(restaurante), adaptada a cafetería. Todos los datos son ficticios.

## Correr local

```bash
docker-compose up --build      # http://localhost:8080  (o: docker compose up --build)
```

Sin Docker:

```bash
npm install
BASE_PATH=/ npm run dev        # http://localhost:4321
npm run check                  # autoverificación de las reglas de dinero
```

## Qué incluye el panel

| Módulo | Qué demuestra |
|---|---|
| Caja | Punto de venta táctil: tamaños, existencias del día, cliente por teléfono, combos automáticos, descuento de cliente, beneficio de empleado, cupones, efectivo con cambio, anticipo, crédito, saldo a favor |
| Barra | Pendiente → Preparando → Lista → Entregada, cobro al entregar (incluye mixto), cortesías auditadas, notas, cancelación que devuelve existencias y saldo, comanda térmica |
| Corte de caja | Corte **ciego**: la cajera cuenta por denominación y nunca ve el esperado; administración ve diferencias |
| Cierre del día | Ventas por hora/día, por método, categoría, tipo de pedido y más vendidos |
| Productos · Insumos · Combos | Catálogo, recetas con costo y margen, combos con probador |
| Clientes · Crédito · Cupones | Monedero (saldo a favor), crédito a empleados por quincena con CSV, bitácora de cortesías |
| Ajustes · Usuarios | Horarios con cupo, fondo de caja, permisos por módulo (ver / editar) |

Los pedidos hechos en la tienda en línea (`/productos`) entran a la barra como "Por cobrar".

## Cómo está hecho

- Astro 7 + Tailwind 4, sin framework de UI. Las vistas del panel viven en `src/admin/views/`.
- Reglas de negocio puras en `src/admin/logic.ts` y mutaciones en `src/admin/actions*.ts`.
- Sin backend: el estado vive en `localStorage` del navegador (`src/admin/store.ts`). Cada navegador tiene
  su copia; "Reiniciar datos del demo" en `/admin` regresa al estado inicial.
- Entrar a `/admin` no pide contraseña: se elige un usuario para mostrar cómo cambian los permisos.
