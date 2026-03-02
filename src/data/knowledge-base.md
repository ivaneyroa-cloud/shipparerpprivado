# ═══════════════════════════════════════════════════════════════
# SHIPPAR GLOBAL LOGISTICS — BASE DE CONOCIMIENTO INTERNA (RAG)
# ═══════════════════════════════════════════════════════════════
# Este archivo es la fuente de verdad que el AI assistant lee
# para responder preguntas sobre la empresa.
# Editalo libremente — los cambios se reflejan en el chat al instante.
# ═══════════════════════════════════════════════════════════════

## 🏢 SOBRE SHIPPAR

Shippar Global Logistics es una empresa argentina de logística integral e importación.
Nos especializamos en importar productos desde múltiples orígenes internacionales hacia Argentina.
Sede principal en Buenos Aires, Argentina.

## 🌍 ORÍGENES DE IMPORTACIÓN

| Código | País/Región | Notas |
|--------|-------------|-------|
| CN | China | Principal origen. Envíos aéreos y marítimos. Proveedores contactados vía WeChat. |
| US | USA / Miami | Hub logístico en Miami. Consolidación de paquetes. |
| PK | Pakistán | Textiles, insumos médicos. |
| ES | España | Productos europeos, cosméticos, alimentos. |
| UK | Reino Unido | Electrónica, moda premium. |
| DE | Alemania | Maquinaria, autopartes, productos industriales. |

## 📦 ESTADOS DE ENVÍO (FLUJO COMPLETO)

El ciclo de vida de un envío en Shippar es:

1. **Guía Creada** → Se registró el tracking en el sistema
2. **Pendiente Expo** → Esperando exportación del país de origen
3. **En Tránsito** → El paquete está viajando hacia Argentina
4. **Recibido en Oficina** → Llegó a nuestras oficinas en Buenos Aires
5. **Estados finales:**
   - **Retirado** → El cliente pasó a buscar su paquete
   - **Despachado** → Se envió al domicilio del cliente
   - **ML / Full (Mercado Libre Full)** → Se derivó a fulfillment de Mercado Libre

## 📋 CATEGORÍAS DE PRODUCTOS

- Ropa / Indumentaria
- Electrónica
- Accesorios
- Suplementos / Vitaminas
- Juguetes
- Calzado
- Insumos Médicos
- Maquinaria / Autopartes
- Otros

## 💰 INFORMACIÓN COMERCIAL

- Moneda principal para cotizaciones: **USD (dólar estadounidense)**
- Métodos de pago aceptados: Transferencia bancaria, MercadoPago
- Las cotizaciones se calculan en base a:
  - Peso real (kg)
  - Peso volumétrico: (Largo × Ancho × Alto en cm) / 5000
  - Se cobra el MAYOR de los dos
- Dimensiones siempre en **centímetros (cm)**, peso en **kilogramos (kg)**

## 📐 CÁLCULO DE PESO VOLUMÉTRICO

Fórmula estándar internacional:
```
Peso Volumétrico (kg) = (Largo cm × Ancho cm × Alto cm) / 5000
```

Si el peso volumétrico es mayor al peso real, se cobra el volumétrico.
Si te dan medidas en pulgadas, convertir primero: 1 pulgada = 2.54 cm.

Ejemplo: Caja de 50 × 40 × 30 cm
→ (50 × 40 × 30) / 5000 = 60000 / 5000 = **12 kg volumétricos**

## 📝 DOCUMENTACIÓN COMÚN

- **Guía aérea (AWB)**: Documento de transporte aéreo
- **Bill of Lading (BL)**: Documento de transporte marítimo
- **Factura comercial (Commercial Invoice)**: Detalle de productos y valores
- **Packing List**: Detalle de contenido y medidas por bulto
- **Despacho de aduana**: Trámite obligatorio para ingreso a Argentina

## 🔧 PROCESOS INTERNOS

### Alta de cliente nuevo:
1. Se carga en el sistema con nombre, CUIT, dirección
2. Se asigna a un vendedor (sales) del equipo
3. Se genera un código único de cliente

### Carga de envío nuevo:
1. Se ingresa tracking number del courier de origen
2. Se asigna al cliente correspondiente
3. Se establece origen, categoría y peso
4. El sistema hace seguimiento automático del estado

### Importaciones desde China:
- Contacto con proveedores vía WeChat
- Consolidación en warehouse de origen
- Envío aéreo (5-10 días) o marítimo (30-45 días)
- Despacho de aduana en Argentina
- Distribución final al cliente

## 🗣️ ESTILO DE COMUNICACIÓN

### Con proveedores chinos (WeChat):
- Tono relajado pero profesional
- Se usan emojis moderadamente
- Saludos: "Hi friend", "Hello"
- Nunca "Dear Sir/Madam" (demasiado formal)
- Negociación directa de precios y plazos

### Con proveedores de USA/Europa:
- Inglés comercial estándar
- Más formal que con China, pero no corporativo
- Foco en tiempos de entrega y tracking

## ❓ PREGUNTAS FRECUENTES

**¿Cuánto tarda un envío desde China?**
Aéreo: 7-15 días hábiles. Marítimo: 35-50 días hábiles.

**¿Cuánto tarda desde USA/Miami?**
Aéreo: 5-10 días hábiles. Courier express: 3-5 días.

**¿Cómo hago seguimiento de mi paquete?**
Cada envío tiene un tracking number que se puede consultar en el sistema.

**¿Puedo importar cualquier producto?**
Hay restricciones para ciertos productos (electrónica con litio, medicamentos, alimentos perecederos). Consultar caso por caso.

**¿Qué pasa si el paquete llega dañado?**
Se documenta con fotos, se reporta al courier de origen y se gestiona el reclamo.
