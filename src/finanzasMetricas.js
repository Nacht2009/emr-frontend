export const ESTADOS_CUENTA = ['Al día', 'Atrasado']

export const METODOS_PAGO = [
  'Efectivo',
  'Pago Móvil',
  'Zelle',
  'Binance',
  'Tarjeta',
]

export function esMetodoPagoValido(metodo) {
  return METODOS_PAGO.includes(metodo)
}

export function normalizarFechaCobroISO(fecha) {
  if (fecha == null || fecha === '') return obtenerFechaHoyISO()
  if (typeof fecha === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(fecha)) {
    return fecha
  }
  const d = new Date(fecha)
  if (!Number.isNaN(d.getTime())) {
    const y = d.getFullYear()
    const m = String(d.getMonth() + 1).padStart(2, '0')
    const day = String(d.getDate()).padStart(2, '0')
    return `${y}-${m}-${day}`
  }
  return String(fecha).slice(0, 10)
}

export function derivarSaldoYEstado(costoTotal, montoPagado) {
  const costo = Number(costoTotal) || 0
  const pagado = Number(montoPagado) || 0
  const saldoPendiente = Math.max(0, costo - pagado)
  const estado = saldoPendiente > 0 ? 'Atrasado' : 'Al día'
  return { saldoPendiente, estado }
}

export function obtenerFechaHoyISO() {
  const d = new Date()
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

export function formatearFechaLegible(fechaISO) {
  if (!fechaISO || typeof fechaISO !== 'string') return '—'
  const partes = fechaISO.split('-')
  if (partes.length < 3) return fechaISO
  const [year, month, day] = partes
  return `${day.padStart(2, '0')}/${month.padStart(2, '0')}/${year}`
}

export function crearRegistroCobro({
  id,
  pacienteId,
  tratamiento,
  costoTotal,
  montoPagado,
  fechaRegistro = obtenerFechaHoyISO(),
}) {
  const costo = Number(costoTotal) || 0
  const pagado = Number(montoPagado) || 0
  const { saldoPendiente, estado } = derivarSaldoYEstado(costo, pagado)

  return {
    id,
    pacienteId,
    tratamiento,
    costoTotal: costo,
    montoPagado: pagado,
    saldoPendiente,
    estado,
    fechaRegistro,
    fecha: formatearFechaLegible(fechaRegistro),
  }
}

/** Fila GET /api/finanzas → modelo usado por KPIs e historial. */
export function cobroDesdeApi(fila) {
  const costoTotal = Number(fila.costo_total) || 0
  const montoPagado = Number(fila.monto_pagado) || 0
  const fechaRegistro = normalizarFechaCobroISO(
    fila.fecha_cobro ?? fila.created_at,
  )

  const registro = crearRegistroCobro({
    id: fila.id,
    pacienteId: fila.paciente_id,
    tratamiento: fila.tratamiento ?? '',
    costoTotal,
    montoPagado,
    fechaRegistro,
  })

  if (fila.saldo_pendiente != null && fila.saldo_pendiente !== '') {
    registro.saldoPendiente = Math.max(0, Number(fila.saldo_pendiente) || 0)
  }

  if (fila.nombre_completo) {
    registro.nombrePaciente = fila.nombre_completo
  }
  if (fila.metodo_pago) {
    registro.metodoPago = fila.metodo_pago
  }

  return registro
}

function marcaTiempoCobro(cobro) {
  if (cobro.fechaRegistro) {
    const ms = Date.parse(`${cobro.fechaRegistro}T12:00:00`)
    if (!Number.isNaN(ms)) return ms
  }
  const idMs = Number(String(cobro.id ?? '').replace(/\D/g, ''))
  return Number.isFinite(idMs) ? idMs : 0
}

export function ordenarHistorialPagos(cobros = []) {
  return [...cobros].sort((a, b) => marcaTiempoCobro(b) - marcaTiempoCobro(a))
}

export function fechaVisibleEnHistorial(cobro) {
  if (cobro.fecha) return cobro.fecha
  if (cobro.fechaRegistro) return formatearFechaLegible(cobro.fechaRegistro)
  return '—'
}

export function formatearMoneda(monto) {
  const valor = Number(monto) || 0
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    maximumFractionDigits: 0,
  }).format(valor)
}

function esFechaEnMesActual(fechaISO) {
  if (!fechaISO) return false
  const partes = fechaISO.split('-')
  if (partes.length < 2) return false
  const year = Number(partes[0])
  const month = Number(partes[1])
  const hoy = new Date()
  return year === hoy.getFullYear() && month === hoy.getMonth() + 1
}

export function sumarIngresosDelMes(cobros = []) {
  return cobros
    .filter((c) => esFechaEnMesActual(c.fechaRegistro))
    .reduce((acc, c) => acc + (Number(c.montoPagado) || 0), 0)
}

export function sumarSaldosPendientes(cobros = []) {
  return cobros.reduce((acc, c) => acc + (Number(c.saldoPendiente) || 0), 0)
}

export function calcularIngresoPromedio(cobros = []) {
  if (!cobros.length) return 0
  const totalIngresos = cobros.reduce(
    (acc, c) => acc + (Number(c.montoPagado) || 0),
    0,
  )
  return totalIngresos / cobros.length
}

export function obtenerTratamientoEstrella(cobros = []) {
  if (!cobros.length) return null

  const totales = cobros.reduce((acc, cobro) => {
    const tratamiento = cobro.tratamiento || 'Sin tratamiento'
    acc[tratamiento] = (acc[tratamiento] ?? 0) + (Number(cobro.montoPagado) || 0)
    return acc
  }, {})

  let ganador = null
  let maxIngreso = -1
  for (const [tratamiento, ingreso] of Object.entries(totales)) {
    if (ingreso > maxIngreso) {
      maxIngreso = ingreso
      ganador = tratamiento
    }
  }
  return ganador
}

export function agruparIngresosPorTratamiento(cobros = []) {
  const totales = cobros.reduce((acc, cobro) => {
    const tratamiento = cobro.tratamiento || 'Sin tratamiento'
    acc[tratamiento] =
      (acc[tratamiento] ?? 0) + (Number(cobro.montoPagado) || 0)
    return acc
  }, {})

  return Object.entries(totales)
    .map(([tratamiento, ingreso]) => ({ tratamiento, ingreso }))
    .sort((a, b) => b.ingreso - a.ingreso)
}

export function etiquetaEstadoHistorial(cobro) {
  const saldo = Number(cobro.saldoPendiente) || 0
  const costo = Number(cobro.costoTotal) || 0
  const pagado = Number(cobro.montoPagado) || 0
  const pendiente = saldo > 0 || pagado < costo

  if (pendiente) {
    return {
      texto: 'Pendiente',
      className: 'bg-amber-100 text-amber-800 ring-amber-600/20',
    }
  }

  return {
    texto: 'Pagado',
    className: 'bg-emerald-100 text-emerald-800 ring-emerald-600/20',
  }
}
