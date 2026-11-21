import { SEGMENT_COLORS } from './clustering';
import type {
  BusinessContext,
  BusinessStrategy,
  ClusteringModelResult,
  DescriptiveStats,
  MatrixQuadrant,
  SegmentProfile,
} from '../types/segmentation';

function formatNum(n: number): string {
  if (Math.abs(n) >= 1000) {
    return n.toLocaleString('es-ES', { maximumFractionDigits: 1 });
  }
  return n.toLocaleString('es-ES', { maximumFractionDigits: 2 });
}

function unitLabels(unit: BusinessContext['observationUnit']) {
  switch (unit) {
    case 'Cliente':
      return { singular: 'cliente', plural: 'clientes' };
    case 'Empresa / Cuenta B2B':
      return { singular: 'cuenta B2B', plural: 'cuentas corporativas' };
    case 'Producto / SKU':
      return { singular: 'producto/SKU', plural: 'productos/SKUs' };
    case 'Sucursal / Punto de venta':
      return { singular: 'sucursal', plural: 'sucursales' };
    case 'Transacción / Pedido':
      return { singular: 'transacción', plural: 'transacciones' };
    case 'Paciente / Usuario':
      return { singular: 'usuario', plural: 'usuarios' };
    default:
      return { singular: 'registro', plural: 'registros' };
  }
}

export function buildSegmentProfiles(
  model: ClusteringModelResult,
  globalStats: DescriptiveStats[],
  context: BusinessContext
): SegmentProfile[] {
  const globalByVar = new Map<string, DescriptiveStats>();
  globalStats.forEach((s) => globalByVar.set(s.variable, s));
  const unit = unitLabels(context.observationUnit);

  return model.clusterSummaries.map((summary, idx) => {
    const color =
      summary.clusterId === -1
        ? '#64748b'
        : SEGMENT_COLORS[summary.clusterId % SEGMENT_COLORS.length];

    const differentiatingVariables = Object.keys(summary.standardizedCentroid)
      .map((variable) => {
        const zScore = summary.standardizedCentroid[variable] ?? 0;
        const clusterMean = summary.originalCentroid[variable] ?? 0;
        const gMean = globalByVar.get(variable)?.mean ?? 0;
        const pctDiffFromGlobal =
          Math.abs(gMean) > 1e-9 ? ((clusterMean - gMean) / Math.abs(gMean)) * 100 : 0;

        const direction: 'alto' | 'bajo' | 'neutro' =
          zScore >= 0.35 ? 'alto' : zScore <= -0.35 ? 'bajo' : 'neutro';

        return {
          variable,
          clusterMean,
          globalMean: Number(gMean.toFixed(2)),
          zScore,
          pctDiffFromGlobal: Number(pctDiffFromGlobal.toFixed(1)),
          direction,
        };
      })
      .sort((a, b) => Math.abs(b.zScore) - Math.abs(a.zScore));

    const positives = differentiatingVariables.filter((d) => d.direction === 'alto');
    const negatives = differentiatingVariables.filter((d) => d.direction === 'bajo');
    const neutrals = differentiatingVariables.filter((d) => d.direction === 'neutro');

    const mainCharacteristics = differentiatingVariables.slice(0, 4).map((d) => {
      const sign = d.pctDiffFromGlobal >= 0 ? '+' : '';
      return `${d.variable}: promedio de ${formatNum(d.clusterMean)} frente a ${formatNum(d.globalMean)} global (${sign}${d.pctDiffFromGlobal}%, z = ${d.zScore >= 0 ? '+' : ''}${d.zScore.toFixed(2)}).`;
    });

    const strengths =
      positives.length > 0
        ? positives.slice(0, 3).map((d) => {
            const nameL = d.variable.toLowerCase();
            if (nameL.includes('recencia') || nameL.includes('devolucion') || nameL.includes('incidencia') || nameL.includes('cobro')) {
              return `Nivel elevado en ${d.variable} (${formatNum(d.clusterMean)}) requiere vigilancia, aunque evidencia actividad/escala relevante.`;
            }
            return `Desempeño superior al promedio en ${d.variable} (${formatNum(d.clusterMean)} vs ${formatNum(d.globalMean)} del total).`;
          })
        : [
            `Estabilidad operativa sin desviaciones extremas; ${unit.plural} predecibles para planificación base.`,
          ];

    const weaknesses =
      negatives.length > 0
        ? negatives.slice(0, 3).map(
            (d) =>
              `Brecha negativa en ${d.variable}: ${formatNum(d.clusterMean)} (${d.pctDiffFromGlobal}% respecto al promedio global).`
          )
        : [
            summary.percentage < 10
              ? `Participación reducida (${summary.percentage}% de la base), lo que limita economías de escala si se diseñan soluciones aisladas.`
              : 'Sin rezagos críticos en las variables analizadas, aunque existe margen de optimización en eficiencia relativa.',
          ];

    const topDriver = differentiatingVariables[0];
    const secondDriver = differentiatingVariables[1];

    const needs = [
      topDriver && topDriver.direction === 'alto'
        ? `Soluciones diseñadas para sostener y capitalizar su intensidad en ${topDriver.variable} (${formatNum(topDriver.clusterMean)}).`
        : topDriver
          ? `Mecanismos de activación o habilitación para elevar ${topDriver.variable} desde su nivel actual (${formatNum(topDriver.clusterMean)}).`
          : `Propuesta de valor adaptada a ${context.sector}.`,
      summary.percentage > 30
        ? `Procesos escalables y estandarizados dado que concentra ${summary.percentage}% del universo de ${unit.plural}.`
        : `Atención focalizada y reglas diferenciadas acordes a su peso específico (${summary.count} ${unit.plural}).`,
    ];

    const behavior =
      positives.length > 0 && negatives.length > 0
        ? `Perfil polarizado en ${context.sector}: sobresale en ${positives
            .slice(0, 2)
            .map((p) => p.variable)
            .join(' y ')}, mientras mantiene niveles contenidos en ${negatives
            .slice(0, 2)
            .map((n) => n.variable)
            .join(' y ')}.`
        : positives.length >= 2
          ? `Comportamiento expansivo en múltiples dimensiones (${positives
              .slice(0, 3)
              .map((p) => p.variable)
              .join(', ')}), posicionándose como núcleo de tracción del negocio.`
          : negatives.length >= 2
            ? `Comportamiento de baja intensidad relativa en ${negatives
                .slice(0, 3)
                .map((n) => n.variable)
                .join(', ')}, con margen para rediseño del modelo de atención o activación.`
            : `Comportamiento equilibrado cercano a la mediana general (${neutrals
                .slice(0, 2)
                .map((n) => n.variable)
                .join(', ')}).`;

    const growthPotential =
      positives.length > 0 && negatives.length > 0
        ? `Alto potencial de expansión asimétrica: convertir su fortaleza en ${positives[0].variable} en palanca para impulsar ${negatives[0].variable}.`
        : positives.length >= 2
          ? `Potencial enfocado en preservación de margen, profundización de cartera y blindaje competitivo más que en volumen incremental básico.`
          : `Potencial condicionado a migrar ${unit.plural} hacia niveles superiores mediante paquetes escalonados o automatización.`;

    const risks = [
      summary.clusterId === -1
        ? 'Casos atípicos fuera de patrón común: aplicar reglas masivas puede generar pérdidas operativas o errores de diagnóstico.'
        : secondDriver && secondDriver.direction === 'bajo'
          ? `Vulnerabilidad en ${secondDriver.variable} (${formatNum(secondDriver.clusterMean)}), que puede erosionar el valor generado en otras métricas.`
          : `Riesgo de tratar este grupo con políticas genéricas del promedio global, desaprovechando su diferenciación estadística (|z| hasta ${Math.abs(topDriver?.zScore ?? 0).toFixed(2)}).`,
      `Dependencia de supuestos sobre estabilidad temporal: se recomienda recalcular la pertenencia periódicamente.`,
    ];

    const commercialOpportunities = [
      topDriver
        ? `Diferenciación de oferta y niveles de servicio anclados en la brecha observada en ${topDriver.variable} (${topDriver.pctDiffFromGlobal >= 0 ? '+' : ''}${topDriver.pctDiffFromGlobal}% vs promedio).`
        : `Optimización de portafolio en ${context.sector}.`,
      negatives[0]
        ? `Programa de captura de valor orientado a cerrar la brecha en ${negatives[0].variable} sin deteriorar las variables donde ya lidera.`
        : `Estrategia de fidelización estructural y acuerdos de largo plazo para consolidar su posición.`,
    ];

    return {
      clusterId: summary.clusterId,
      strategicName: summary.strategicName,
      color,
      count: summary.count,
      percentage: summary.percentage,
      mainCharacteristics,
      differentiatingVariables,
      strengths,
      weaknesses,
      needs,
      behavior,
      growthPotential,
      risks,
      commercialOpportunities,
    };
  });
}

export function classifyQuadrant(impactScore: number, effortScore: number): MatrixQuadrant {
  const highImpact = impactScore >= 6;
  const highEffort = effortScore >= 6;
  if (highImpact && !highEffort) return 'Alto Impacto / Bajo Esfuerzo';
  if (highImpact && highEffort) return 'Alto Impacto / Alto Esfuerzo';
  if (!highImpact && !highEffort) return 'Bajo Impacto / Bajo Esfuerzo';
  return 'Bajo Impacto / Alto Esfuerzo';
}

export function generateNonObviousStrategies(
  profiles: SegmentProfile[],
  context: BusinessContext
): BusinessStrategy[] {
  const strategies: BusinessStrategy[] = [];
  const unit = unitLabels(context.observationUnit);

  profiles.forEach((profile) => {
    const sortedVars = profile.differentiatingVariables;
    const topPos = sortedVars.find((v) => v.zScore >= 0.35) ?? sortedVars[0];
    const topNeg = sortedVars.find((v) => v.zScore <= -0.35) ?? sortedVars[sortedVars.length - 1];

    const findVarByKeywords = (keywords: string[]) =>
      sortedVars.find((v) =>
        keywords.some((kw) => v.variable.toLowerCase().includes(kw))
      );

    const monetaryVar = findVarByKeywords([
      'gasto',
      'ingreso',
      'facturacion',
      'venta',
      'ticket',
      'monto',
      'valor',
      'precio',
    ]);
    const freqVar = findVarByKeywords([
      'frecuencia',
      'envios',
      'compras',
      'operaciones',
      'pedidos',
      'visitas',
    ]);
    const marginVar = findVarByKeywords(['margen', 'rentabilidad', 'utilidad']);
    const frictionVar = findVarByKeywords([
      'devolucion',
      'incidencia',
      'reclamo',
      'queja',
      'cobro',
      'mora',
      'recencia',
    ]);
    const tenureVar = findVarByKeywords(['antiguedad', 'meses', 'permanencia', 'contrato']);

    const baseImpact = Math.min(
      10,
      Math.max(
        4,
        Math.round(
          4 +
            (profile.percentage / 100) * 6 +
            Math.min(2.5, Math.abs(topPos?.zScore ?? 0) * 1.4)
        )
      )
    );

    if (profile.clusterId === -1) {
      const impact = 6;
      const effort = 3;
      strategies.push({
        id: `strat-${profile.clusterId}-1`,
        clusterId: profile.clusterId,
        segmentName: profile.strategicName,
        strategicAxis: 'Gobierno de Datos y Revisión Excepcional',
        problemOrOpportunity: `${profile.count} ${unit.plural} (${profile.percentage}%) presentan combinaciones de métricas alejadas de los núcleos principales.`,
        dataEvidence: `${topPos?.variable}: ${formatNum(topPos?.clusterMean ?? 0)} vs ${formatNum(topPos?.globalMean ?? 0)} global (z = ${topPos?.zScore.toFixed(2)}).`,
        proposedStrategy:
          'Protocolo de auditoría y gestión caso por caso con reglas de aprobación diferenciadas antes de aplicar políticas automáticas.',
        implementationMechanism:
          'Separar estos registros en una cola de revisión comercial/operativa para validar si corresponden a cuentas especiales de altísimo potencial o anomalías de registro.',
        expectedImpact:
          'Evita decisiones comerciales erróneas y protege márgenes frente a condiciones fuera de estándar.',
        kpi: `% de ${unit.plural} atípicos auditados y reclasificados en 30 días`,
        risksAndAssumptions:
          'Asume capacidad operativa para revisión manual acotada al tamaño reducido del grupo.',
        horizon: 'Corto plazo (0-3 meses)',
        impactScore: impact,
        effortScore: effort,
        quadrant: classifyQuadrant(impact, effort),
        suggestedOwner: 'Analítica de Negocio / Operaciones',
        scoringRationale: `Impacto ${impact}/10 (prevención de distorsión en ${profile.percentage}% de casos) · Esfuerzo ${effort}/10 (flujo de auditoría acotado).`,
      });
      return;
    }

    // Strategy 1: Monetization, Pricing Architecture, or Cost-to-Serve Redesign
    if (
      freqVar &&
      monetaryVar &&
      freqVar.zScore >= 0.35 &&
      (monetaryVar.zScore <= 0.1 || (marginVar && marginVar.zScore <= -0.25))
    ) {
      // High frequency, low ticket/margin -> Cost-to-serve + bundling threshold
      const impact = Math.min(10, baseImpact + 1);
      const effort = 4;
      strategies.push({
        id: `strat-${profile.clusterId}-1`,
        clusterId: profile.clusterId,
        segmentName: profile.strategicName,
        strategicAxis: 'Arquitectura de Precios y Reducción de Costo de Atención',
        problemOrOpportunity: `Alta intensidad operativa (${freqVar.variable} = ${formatNum(freqVar.clusterMean)}) combinada con menor captura unitaria (${monetaryVar.variable} = ${formatNum(monetaryVar.clusterMean)}).`,
        dataEvidence: `${freqVar.variable} supera el promedio en ${freqVar.pctDiffFromGlobal >= 0 ? '+' : ''}${freqVar.pctDiffFromGlobal}%, mientras ${marginVar ? `${marginVar.variable} es ${formatNum(marginVar.clusterMean)} vs ${formatNum(marginVar.globalMean)} global` : `${monetaryVar.variable} está en ${formatNum(monetaryVar.clusterMean)}`}.`,
        proposedStrategy:
          'Introducir umbrales de consolidación o membresía de reposición programada + migración de interacciones rutinarias a autoservicio digital.',
        implementationMechanism:
          'Reemplazar transacciones unitarias frecuentes por paquetes consolidados con beneficio por volumen mínimo y automatizar gestión operativa en canal digital.',
        expectedImpact:
          'Incremento del tamaño de operación y reducción del costo operativo por transacción sin recurrir a descuentos lineales.',
        kpi: `Margen neto por ${unit.singular} y variación de ${monetaryVar.variable} promedio`,
        risksAndAssumptions:
          'Requiere comunicar el beneficio de consolidación sin generar fricción en la frecuencia habitual.',
        horizon: 'Corto plazo (0-3 meses)',
        impactScore: impact,
        effortScore: effort,
        quadrant: classifyQuadrant(impact, effort),
        suggestedOwner: 'Dirección Comercial & Pricing',
        scoringRationale: `Impacto ${impact}/10 (${profile.percentage}% del total con alta frecuencia aprovechable) · Esfuerzo ${effort}/10 (ajuste de reglas comerciales y canales existentes).`,
      });
    } else if (
      monetaryVar &&
      monetaryVar.zScore >= 0.45 &&
      (!frictionVar || frictionVar.zScore <= 0.3)
    ) {
      // High-value core segment -> Value-based tiering / ecosystem lock-in
      const impact = Math.min(10, baseImpact + 2);
      const effort = 7;
      strategies.push({
        id: `strat-${profile.clusterId}-1`,
        clusterId: profile.clusterId,
        segmentName: profile.strategicName,
        strategicAxis: 'Blindaje de Valor y Modelos de Ingreso Recurrente',
        problemOrOpportunity: `Segmento ancla en ${monetaryVar.variable} (${formatNum(monetaryVar.clusterMean)}), altamente expuesto a competencia por precio si no existen barreras de salida funcionales.`,
        dataEvidence: `${monetaryVar.variable} = ${formatNum(monetaryVar.clusterMean)} (${monetaryVar.pctDiffFromGlobal >= 0 ? '+' : ''}${monetaryVar.pctDiffFromGlobal}% sobre el promedio global de ${formatNum(monetaryVar.globalMean)}, z = +${monetaryVar.zScore.toFixed(2)}).`,
        proposedStrategy:
          'Diseñar una propuesta de valor por nivel con acuerdos anuales/retainers, servicios exclusivos de continuidad operativa y co-creación de soluciones.',
        implementationMechanism:
          'Integrar beneficios no replicables por descuento (niveles SLA prioritarios, acceso anticipado, reportes de desempeño o integración técnica directa) sujetos a compromiso de permanencia.',
        expectedImpact:
          'Mayor previsibilidad de ingresos y retención estructural de los registros de mayor contribución.',
        kpi: `Tasa de retención del segmento y participación de ingresos bajo acuerdo recurrente`,
        risksAndAssumptions:
          'Exige consistencia impecable en la promesa de servicio prioritario para evitar deterioro reputacional.',
        horizon: 'Mediano plazo (3-9 meses)',
        impactScore: impact,
        effortScore: effort,
        quadrant: classifyQuadrant(impact, effort),
        suggestedOwner: 'Gerencia de Cuentas Clave / Producto',
        scoringRationale: `Impacto ${impact}/10 (protección de núcleo de alto valor en ${profile.percentage}% de la base) · Esfuerzo ${effort}/10 (requiere diseño contractual y coordinación operativa).`,
      });
    } else {
      // General asymmetric leverage strategy
      const impact = baseImpact;
      const effort = 5;
      strategies.push({
        id: `strat-${profile.clusterId}-1`,
        clusterId: profile.clusterId,
        segmentName: profile.strategicName,
        strategicAxis: 'Rediseño de Propuesta de Valor y Venta Complementaria',
        problemOrOpportunity: `Desempeño diferencial en ${topPos.variable} (${formatNum(topPos.clusterMean)}) con brecha aprovechable en ${topNeg.variable} (${formatNum(topNeg.clusterMean)}).`,
        dataEvidence: `Brecha de z = ${topPos.zScore.toFixed(2)} en ${topPos.variable} frente a z = ${topNeg.zScore.toFixed(2)} en ${topNeg.variable} en ${profile.count} ${unit.plural} (${profile.percentage}%).`,
        proposedStrategy:
          'Empaquetamiento modular cruzado que utilice el atributo dominante como punto de entrada para incorporar líneas/servicios complementarios de mayor contribución.',
        implementationMechanism:
          `Configurar recomendaciones contextuales y paquetes de transición orientados a elevar ${topNeg.variable} sin alterar el atributo donde el segmento ya responde positivamente.`,
        expectedImpact:
          `Expansión balanceada de cartera en ${topNeg.variable} y mejora en la contribución agregada del segmento.`,
        kpi: `Evolución trimestral de ${topNeg.variable} y tasa de adopción de oferta complementaria`,
        risksAndAssumptions:
          'Supone elasticidad cruzada positiva entre las variables observadas (validar mediante prueba piloto controlada antes de escalar).',
        horizon: 'Corto plazo (0-3 meses)',
        impactScore: impact,
        effortScore: effort,
        quadrant: classifyQuadrant(impact, effort),
        suggestedOwner: 'Marketing Estratégico / Desarrollo de Oferta',
        scoringRationale: `Impacto ${impact}/10 (brecha cuantificada de ${Math.abs(topNeg.pctDiffFromGlobal)}% en ${topNeg.variable}) · Esfuerzo ${effort}/10 (empaquetamiento sobre oferta vigente).`,
      });
    }

    // Strategy 2: Friction, Churn Prevention, Operational Efficiency, or Channel/Market Innovation
    if (frictionVar && frictionVar.zScore >= 0.4) {
      const impact = Math.min(10, baseImpact + 1);
      const effort = 4;
      strategies.push({
        id: `strat-${profile.clusterId}-2`,
        clusterId: profile.clusterId,
        segmentName: profile.strategicName,
        strategicAxis: 'Prevención de Fuga y Eliminación de Fricción Operativa',
        problemOrOpportunity: `Nivel crítico en ${frictionVar.variable} (${formatNum(frictionVar.clusterMean)}), señal temprana de deterioro de experiencia o sobrecosto oculto.`,
        dataEvidence: `${frictionVar.variable} supera el promedio global (${formatNum(frictionVar.globalMean)}) en +${frictionVar.pctDiffFromGlobal}% (z = +${frictionVar.zScore.toFixed(2)}).`,
        proposedStrategy:
          'Implementar disparadores tempranos de intervención preventiva y rediseñar las causas raíz de fricción antes de que se materialice la pérdida o el sobrecosto.',
        implementationMechanism:
          `Establecer alertas automáticas cuando ${frictionVar.variable} supere el umbral P75 del segmento, acompañadas de protocolo de resolución en primer contacto o revisión de condiciones.`,
        expectedImpact:
          `Disminución sostenida de ${frictionVar.variable} y preservación de la base activa del segmento.`,
        kpi: `Reducción porcentual de ${frictionVar.variable} y tasa de continuidad a 90 días`,
        risksAndAssumptions:
          'Las correlaciones con fricción pueden deberse a factores externos de canal o estacionalidad; validar causa raíz en muestra piloto.',
        horizon: 'Corto plazo (0-3 meses)',
        impactScore: impact,
        effortScore: effort,
        quadrant: classifyQuadrant(impact, effort),
        suggestedOwner: 'Operaciones & Experiencia del Cliente',
        scoringRationale: `Impacto ${impact}/10 (mitigación directa de riesgo operativo medido) · Esfuerzo ${effort}/10 (reglas de alerta sobre procesos actuales).`,
      });
    } else if (tenureVar && tenureVar.zScore <= -0.45) {
      const impact = Math.max(5, baseImpact);
      const effort = 6;
      strategies.push({
        id: `strat-${profile.clusterId}-2`,
        clusterId: profile.clusterId,
        segmentName: profile.strategicName,
        strategicAxis: 'Aceleración de Maduración y Fidelización Temprana',
        problemOrOpportunity: `Cohorte reciente (${tenureVar.variable} = ${formatNum(tenureVar.clusterMean)}) que aún no consolida hábitos de permanencia.`,
        dataEvidence: `${tenureVar.variable} es ${tenureVar.pctDiffFromGlobal}% menor que el promedio global (${formatNum(tenureVar.globalMean)}) en ${profile.count} ${unit.plural}.`,
        proposedStrategy:
          'Programa de acompañamiento estructurado por hitos durante los primeros ciclos de relación para acelerar la transición hacia el perfil consolidado.',
        implementationMechanism:
          'Diseñar hitos de activación secuencial (primeras 3 interacciones/meses) con incentivos vinculados a adopción de segunda categoría o funcionalidad clave, en lugar de descuentos iniciales únicos.',
        expectedImpact:
          'Aumento de la supervivencia temprana y aceleración del paso hacia segmentos de mayor estabilidad.',
        kpi: `Tasa de conversión de cohorte temprana hacia segunda compra/renovación en 6 meses`,
        risksAndAssumptions:
          'Requiere coordinación entre adquisición y postventa para evitar mensajes desconectados.',
        horizon: 'Mediano plazo (3-9 meses)',
        impactScore: impact,
        effortScore: effort,
        quadrant: classifyQuadrant(impact, effort),
        suggestedOwner: 'Crecimiento & Ciclo de Vida',
        scoringRationale: `Impacto ${impact}/10 (construye base futura sobre cohorte joven) · Esfuerzo ${effort}/10 (requiere orquestación omnicanal por hitos).`,
      });
    } else {
      const impact = Math.max(4, baseImpact - 1);
      const effort = profile.percentage < 15 ? 8 : 5;
      strategies.push({
        id: `strat-${profile.clusterId}-2`,
        clusterId: profile.clusterId,
        segmentName: profile.strategicName,
        strategicAxis: 'Innovación de Modelo Operativo y Alianzas de Ecosistema',
        problemOrOpportunity: `Oportunidad de diferenciación competitiva aprovechando la estabilidad del segmento (${profile.percentage}% de participación) mediante nuevas vías de valor.`,
        dataEvidence: `Consistencia en ${sortedVars
          .slice(0, 2)
          .map((v) => `${v.variable} (${formatNum(v.clusterMean)})`)
          .join(' y ')} dentro de ${context.sector}.`,
        proposedStrategy:
          'Desarrollar alianzas complementarias o capacidades de autoservicio/inteligencia compartida que agreguen valor sin expandir proporcionalmente la estructura de costos.',
        implementationMechanism:
          'Integrar beneficios de socios estratégicos no competidores o herramientas de autogestión y reportes de valor para elevar el costo de cambio percibido.',
        expectedImpact:
          'Diferenciación frente a competidores de precio bajo y apertura de fuentes de ingreso complementarias.',
        kpi: `Tasa de adopción de servicios extendidos / alianzas y margen por ${unit.singular}`,
        risksAndAssumptions:
          'Depende de disponibilidad de socios estratégicos y capacidad de integración tecnológica.',
        horizon: effort >= 7 ? 'Largo plazo (9-18 meses)' : 'Mediano plazo (3-9 meses)',
        impactScore: impact,
        effortScore: effort,
        quadrant: classifyQuadrant(impact, effort),
        suggestedOwner: 'Innovación y Alianzas Estratégicas',
        scoringRationale: `Impacto ${impact}/10 (diferenciación sostenible) · Esfuerzo ${effort}/10 (${effort >= 7 ? 'requiere desarrollo de ecosistema o integración' : 'implementación modular progresiva'}).`,
      });
    }
  });

  return strategies;
}
