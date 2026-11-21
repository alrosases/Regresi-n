import type { BusinessContext } from '../types/segmentation';

function createPrng(seed: number) {
  let state = seed >>> 0;
  return () => {
    state = (state + 0x6d2b79f5) | 0;
    let t = Math.imul(state ^ (state >>> 15), 1 | state);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function normal(rand: () => number, mean: number, std: number): number {
  const u1 = Math.max(1e-7, rand());
  const u2 = rand();
  const z = Math.sqrt(-2.0 * Math.log(u1)) * Math.cos(2.0 * Math.PI * u2);
  return mean + z * std;
}

export interface SampleDatasetDescriptor {
  id: string;
  title: string;
  subtitle: string;
  fileName: string;
  suggestedContext: BusinessContext;
  buildRows: () => Record<string, unknown>[];
}

export const SAMPLE_DATASETS: SampleDatasetDescriptor[] = [
  {
    id: 'retail-b2c',
    title: 'Comercio y Retail: Cartera de Clientes Omnicanal (300 registros)',
    subtitle:
      'Incluye frecuencia de compra, gasto acumulado, ticket promedio, margen bruto, antigüedad, recencia, devoluciones e identificadores.',
    fileName: 'cartera_clientes_retail_b2c.csv',
    suggestedContext: {
      sector: 'Comercio y retail',
      customSectorDetail: '',
      observationUnit: 'Cliente',
      customUnitDetail: '',
      businessDescription:
        'Cadena minorista omnicanal con tienda física y canal digital de categorías de hogar, electrónica ligera y estilo de vida.',
      segmentationObjective:
        'Diferenciar la base activa para incrementar margen neto por cliente, reducir costo de atención en compradores de bajo ticket y retener cuentas de alto valor.',
      currencySymbol: '$',
    },
    buildRows: () => {
      const rand = createPrng(202604);
      const rows: Record<string, unknown>[] = [];
      const channels = ['Web', 'Tienda Física', 'App Móvil', 'Omnicanal'];
      const cities = ['Madrid', 'Barcelona', 'Valencia', 'Sevilla', 'Bilbao'];

      for (let i = 1; i <= 300; i++) {
        const archetype = rand();
        let gastoAnual: number;
        let frecuencia: number;
        let antiguedadMeses: number;
        let recenciaDias: number;
        let margenPct: number;
        let tasaDevolucionPct: number;
        let usoCanalDigitalPct: number;
        let canal: string;

        if (archetype < 0.22) {
          // Clientes VIP omnicanal consolidados
          frecuencia = Math.max(10, Math.round(normal(rand, 19, 4.2)));
          const ticket = Math.max(85, normal(rand, 220, 48));
          gastoAnual = Math.round(frecuencia * ticket);
          antiguedadMeses = Math.max(12, Math.round(normal(rand, 46, 12)));
          recenciaDias = Math.max(2, Math.round(normal(rand, 14, 8)));
          margenPct = Math.min(48, Math.max(18, Number(normal(rand, 31, 4.5).toFixed(1))));
          tasaDevolucionPct = Math.max(0, Number(normal(rand, 3.2, 1.8).toFixed(1)));
          usoCanalDigitalPct = Math.min(100, Math.max(30, Math.round(normal(rand, 68, 15))));
          canal = 'Omnicanal';
        } else if (archetype < 0.50) {
          // Compradores frecuentes sensibles a promoción / bajo ticket
          frecuencia = Math.max(8, Math.round(normal(rand, 16, 3.5)));
          const ticket = Math.max(20, normal(rand, 46, 11));
          gastoAnual = Math.round(frecuencia * ticket);
          antiguedadMeses = Math.max(6, Math.round(normal(rand, 25, 9)));
          recenciaDias = Math.max(3, Math.round(normal(rand, 19, 10)));
          margenPct = Math.min(35, Math.max(8, Number(normal(rand, 16.5, 3.8).toFixed(1))));
          tasaDevolucionPct = Math.max(0, Number(normal(rand, 9.5, 3.9).toFixed(1)));
          usoCanalDigitalPct = Math.min(100, Math.max(40, Math.round(normal(rand, 82, 12))));
          canal = rand() < 0.65 ? 'App Móvil' : 'Web';
        } else if (archetype < 0.77) {
          // Compradores esporádicos de ticket medio-alto (riesgo de fuga)
          frecuencia = Math.max(1, Math.round(normal(rand, 3.4, 1.3)));
          const ticket = Math.max(70, normal(rand, 175, 42));
          gastoAnual = Math.round(frecuencia * ticket);
          antiguedadMeses = Math.max(4, Math.round(normal(rand, 30, 14)));
          recenciaDias = Math.max(25, Math.round(normal(rand, 98, 28)));
          margenPct = Math.min(44, Math.max(14, Number(normal(rand, 27.5, 4.2).toFixed(1))));
          tasaDevolucionPct = Math.max(0, Number(normal(rand, 4.8, 2.5).toFixed(1)));
          usoCanalDigitalPct = Math.min(100, Math.max(0, Math.round(normal(rand, 32, 18))));
          canal = 'Tienda Física';
        } else {
          // Nuevos / emergentes digitales de baja antigüedad
          frecuencia = Math.max(1, Math.round(normal(rand, 4.5, 1.8)));
          const ticket = Math.max(28, normal(rand, 72, 18));
          gastoAnual = Math.round(frecuencia * ticket);
          antiguedadMeses = Math.max(1, Math.round(normal(rand, 6.5, 3.2)));
          recenciaDias = Math.max(5, Math.round(normal(rand, 34, 16)));
          margenPct = Math.min(40, Math.max(12, Number(normal(rand, 23.0, 4.0).toFixed(1))));
          tasaDevolucionPct = Math.max(0, Number(normal(rand, 6.1, 2.7).toFixed(1)));
          usoCanalDigitalPct = Math.min(100, Math.max(45, Math.round(normal(rand, 76, 14))));
          canal = channels[Math.floor(rand() * 3)];
        }

        const ticketPromedio = Number((gastoAnual / frecuencia).toFixed(2));
        // Introducir pocos valores faltantes y un par de extremos realistas para validar los módulos de calidad y reglas de negocio
        const missingMargen = i === 44 || i === 128 || i === 219;
        const missingDevol = i === 77 || i === 189;
        const extremeVipBoost = i === 15 ? 3.1 : 1;

        rows.push({
          id_cliente: `CLI-${String(1000 + i)}`,
          ciudad: cities[i % cities.length],
          canal_preferido: canal,
          gasto_anual_usd: Math.round(gastoAnual * extremeVipBoost),
          frecuencia_compras: frecuencia,
          ticket_promedio_usd: Number((ticketPromedio * extremeVipBoost).toFixed(2)),
          antiguedad_meses: antiguedadMeses,
          recencia_dias: recenciaDias,
          margen_promedio_pct: missingMargen ? '' : margenPct,
          tasa_devolucion_pct: missingDevol ? '' : tasaDevolucionPct,
          participacion_digital_pct: usoCanalDigitalPct,
          programa_fidelidad: antiguedadMeses > 18 && gastoAnual > 900 ? 'Sí' : 'No',
          pais_operacion: 'España',
        });
      }

      // Añadir 2 duplicados exactos para validar el detector de duplicados del Módulo 2
      rows.push({ ...rows[10] });
      rows.push({ ...rows[45] });
      return rows;
    },
  },
  {
    id: 'b2b-logistics',
    title: 'Transporte y Logística B2B: Cuentas Corporativas (240 empresas)',
    subtitle:
      'Unidad de análisis: Empresa cliente. Volumen de envíos, facturación mensual, puntualidad SLA, incidencias, rutas activas y días de cobro.',
    fileName: 'cuentas_corporativas_logistica_b2b.csv',
    suggestedContext: {
      sector: 'Transporte y logística',
      customSectorDetail: '',
      observationUnit: 'Empresa / Cuenta B2B',
      customUnitDetail: '',
      businessDescription:
        'Operador logístico B2B de carga paletizada, última milla corporativa y distribución regional.',
      segmentationObjective:
        'Estructurar niveles de servicio SLA, revisar condiciones de crédito y diseñar contratos híbridos según estabilidad operativa y rentabilidad de cada cuenta.',
      currencySymbol: '$',
    },
    buildRows: () => {
      const rand = createPrng(991177);
      const rows: Record<string, unknown>[] = [];
      const industrias = ['Manufactura', 'Farma', 'Retail', 'Alimentos', 'Tecnología'];

      for (let i = 1; i <= 240; i++) {
        const g = rand();
        let facturacionMensual: number;
        let enviosMes: number;
        let margenOperativoPct: number;
        let diasCobro: number;
        let tasaIncidenciasPct: number;
        let antiguedadMeses: number;

        if (g < 0.25) {
          // Cuentas ancla de alto volumen y alta exigencia financiera (DSO largo)
          facturacionMensual = Math.round(normal(rand, 48000, 9500));
          enviosMes = Math.max(40, Math.round(normal(rand, 210, 45)));
          margenOperativoPct = Number(Math.max(9, normal(rand, 17.5, 3.0)).toFixed(1));
          diasCobro = Math.max(30, Math.round(normal(rand, 72, 12)));
          tasaIncidenciasPct = Number(Math.max(0.2, normal(rand, 1.8, 0.7)).toFixed(2));
          antiguedadMeses = Math.max(12, Math.round(normal(rand, 54, 14)));
        } else if (g < 0.60) {
          // Cuentas medianas de alto margen y pago ágil
          facturacionMensual = Math.round(normal(rand, 16500, 4200));
          enviosMes = Math.max(15, Math.round(normal(rand, 68, 18)));
          margenOperativoPct = Number(Math.max(14, normal(rand, 28.5, 4.2)).toFixed(1));
          diasCobro = Math.max(10, Math.round(normal(rand, 28, 8)));
          tasaIncidenciasPct = Number(Math.max(0.1, normal(rand, 1.2, 0.5)).toFixed(2));
          antiguedadMeses = Math.max(6, Math.round(normal(rand, 32, 11)));
        } else {
          // Cuentas pequeñas con alta fricción operativa / incidencias
          facturacionMensual = Math.round(Math.max(1800, normal(rand, 5400, 1900)));
          enviosMes = Math.max(4, Math.round(normal(rand, 26, 9)));
          margenOperativoPct = Number(Math.max(5, normal(rand, 13.0, 3.6)).toFixed(1));
          diasCobro = Math.max(15, Math.round(normal(rand, 45, 14)));
          tasaIncidenciasPct = Number(Math.max(1.5, normal(rand, 6.4, 2.1)).toFixed(2));
          antiguedadMeses = Math.max(2, Math.round(normal(rand, 13, 6)));
        }

        rows.push({
          codigo_cuenta: `EMP-${2000 + i}`,
          sector_cliente: industrias[i % industrias.length],
          facturacion_mensual_usd: Math.max(1200, facturacionMensual),
          envios_mensuales: enviosMes,
          margen_operativo_pct: margenOperativoPct,
          dias_promedio_cobro: diasCobro,
          tasa_incidencias_pct: i === 55 ? 18.4 : tasaIncidenciasPct,
          antiguedad_contrato_meses: antiguedadMeses,
          rutas_activas: Math.max(1, Math.round(enviosMes / 14 + rand() * 3)),
        });
      }
      return rows;
    },
  },
];
