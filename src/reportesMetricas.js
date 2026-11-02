function esFechaEnMesActual(fechaISO) {
  if (!fechaISO || typeof fechaISO !== 'string') return false
  const partes = fechaISO.split('-')
  if (partes.length < 2) return false
  const year = Number(partes[0])
  const month = Number(partes[1])
  if (!year || !month) return false
  const hoy = new Date()
  return year === hoy.getFullYear() && month === hoy.getMonth() + 1
}

export function contarCitasMesActual(citas = []) {
  return citas.filter((cita) => esFechaEnMesActual(cita.fecha)).length
}

export function contarTratamientosActivos(pacientes = []) {
  return pacientes.filter((p) => p.estado === 'En Tratamiento').length
}

export function calcularTasaCancelacion(citas = []) {
  const total = citas.length
  if (total === 0) return 0
  const canceladas = citas.filter((c) => c.estado === 'Cancelado').length
  return (canceladas / total) * 100
}

export function formatearTasaCancelacion(citas = []) {
  return `${calcularTasaCancelacion(citas).toFixed(1)}%`
}

function marcaTiempoCita(cita) {
  const fecha = cita?.fecha ?? '1970-01-01'
  const hora = cita?.horaInicio ?? '00:00'
  const ms = Date.parse(`${fecha}T${hora}:00`)
  return Number.isNaN(ms) ? 0 : ms
}

export function actividadRecienteCompletadas(citas = [], limite = 3) {
  return [...citas]
    .filter((c) => c.estado === 'Completado')
    .sort((a, b) => marcaTiempoCita(b) - marcaTiempoCita(a))
    .slice(0, limite)
    .map((cita) => ({
      id: cita.id,
      paciente: cita.paciente,
      fecha: cita.fecha,
      motivo: cita.tratamiento ?? '—',
    }))
}

const RANGOS_EDAD = [
  { id: 'pediatrico', label: '0-17 años', min: 0, max: 17 },
  { id: 'joven', label: '18-35 años', min: 18, max: 35 },
  { id: 'adulto', label: '36-55 años', min: 36, max: 55 },
  { id: 'maduro', label: '56+ años', min: 56, max: 200 },
]

export function agruparPacientesPorRangoEdad(pacientes = []) {
  const total = pacientes.length
  if (total === 0) return []

  const conteo = RANGOS_EDAD.reduce((acc, rango) => {
    acc[rango.id] = 0
    return acc
  }, {})

  pacientes.forEach((paciente) => {
    const edad = Number(paciente.edad)
    if (!Number.isFinite(edad)) return
    const rango = RANGOS_EDAD.find((item) => edad >= item.min && edad <= item.max)
    if (rango) conteo[rango.id] += 1
  })

  return RANGOS_EDAD.map((rango) => ({
    rango: rango.label,
    pacientes: conteo[rango.id],
    porcentaje: Number(((conteo[rango.id] / total) * 100).toFixed(1)),
  })).filter((item) => item.pacientes > 0)
}

function esFechaEnMesActualISO(fechaISO) {
  if (!fechaISO) return false
  const ms = Date.parse(fechaISO)
  if (Number.isNaN(ms)) return false
  const fecha = new Date(ms)
  const hoy = new Date()
  return (
    fecha.getFullYear() === hoy.getFullYear() &&
    fecha.getMonth() === hoy.getMonth()
  )
}

export function contarNuevosPacientesMesActual(pacientes = []) {
  return pacientes.filter((paciente) =>
    esFechaEnMesActualISO(paciente.fecha_registro),
  ).length
}
