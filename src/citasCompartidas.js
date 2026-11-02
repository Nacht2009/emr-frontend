/** @deprecated Usar obtenerFechaHoyISO(); se mantiene por compatibilidad. */
export const FECHA_CITAS_OPERATIVA = '2026-09-20'

export function obtenerFechaHoyISO() {
  const d = new Date()
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

export function normalizarFechaCita(fecha) {
  if (fecha == null || fecha === '') return ''
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

export function normalizarHoraCita(hora) {
  if (hora == null || hora === '') return '09:00'
  const texto = String(hora).trim()
  const match = texto.match(/^(\d{1,2}):(\d{2})/)
  if (match) {
    return `${String(Number(match[1])).padStart(2, '0')}:${match[2]}`
  }
  return texto.slice(0, 5)
}

export const ESTADOS_CITA = ['Agendado', 'Completado', 'Cancelado']

export const TRATAMIENTOS_ODONTOLOGICOS = [
  'Evaluación inicial',
  'Endodoncia Unirradicular',
  'Retratamiento',
  'Obturación definitiva',
  'Cirugía Apical',
]

export function esTratamientoCatalogo(tratamiento) {
  return TRATAMIENTOS_ODONTOLOGICOS.includes(tratamiento)
}

export function esEstadoCitaValido(estado) {
  return ESTADOS_CITA.includes(estado)
}

/** Normaliza estados legacy al conjunto válido de citas. */
export function normalizarEstadoCita(estado) {
  if (esEstadoCitaValido(estado)) return estado
  const legacy = String(estado ?? '').toLowerCase()
  if (legacy === 'asistido' || legacy === 'confirmado' || legacy === 'atendida') {
    return 'Completado'
  }
  if (legacy === 'programada') return 'Agendado'
  if (legacy === 'cancelada') return 'Cancelado'
  return 'Agendado'
}

export const CITAS_INICIALES_COMPARTIDAS = [
  {
    id: 'CIT-004',
    pacienteId: 'PAC-004',
    paciente: 'Luis Fernández',
    fecha: FECHA_CITAS_OPERATIVA,
    horaInicio: '08:45',
    horaFin: '09:30',
    tratamiento: 'Obturación definitiva',
    estado: 'Completado',
  },
  {
    id: 'CIT-001',
    pacienteId: 'PAC-006',
    paciente: 'Roberto Sánchez',
    fecha: FECHA_CITAS_OPERATIVA,
    horaInicio: '09:00',
    horaFin: '10:00',
    tratamiento: 'Endodoncia Unirradicular',
    estado: 'Agendado',
  },
  {
    id: 'CIT-002',
    pacienteId: 'PAC-005',
    paciente: 'Elena Vargas',
    fecha: FECHA_CITAS_OPERATIVA,
    horaInicio: '10:30',
    horaFin: '11:30',
    tratamiento: 'Evaluación inicial',
    estado: 'Agendado',
  },
  {
    id: 'CIT-003',
    pacienteId: 'PAC-003',
    paciente: 'Ana Martínez',
    fecha: FECHA_CITAS_OPERATIVA,
    horaInicio: '11:15',
    horaFin: '12:00',
    tratamiento: 'Evaluación inicial',
    estado: 'Agendado',
  },
  {
    id: 'CIT-005',
    pacienteId: 'PAC-002',
    paciente: 'Carlos Ruiz',
    fecha: FECHA_CITAS_OPERATIVA,
    horaInicio: '11:45',
    horaFin: '12:45',
    tratamiento: 'Retratamiento',
    estado: 'Agendado',
  },
]

export function combinarFechaHora(fechaISO, horaHHMM) {
  const [year, month, day] = fechaISO.split('-').map(Number)
  const [hours, minutes] = horaHHMM.split(':').map(Number)
  return new Date(year, month - 1, day, hours, minutes, 0, 0)
}

export function formatearHora12(hora24) {
  const [h, m] = hora24.split(':').map(Number)
  const periodo = h >= 12 ? 'PM' : 'AM'
  const hora12 = h % 12 || 12
  return `${String(hora12).padStart(2, '0')}:${String(m).padStart(2, '0')} ${periodo}`
}

export function claseBadgeEstadoCita(estado) {
  switch (estado) {
    case 'Agendado':
      return 'bg-blue-100 text-blue-800 ring-blue-600/20'
    case 'Completado':
      return 'bg-emerald-100 text-emerald-800 ring-emerald-600/20'
    case 'Cancelado':
      return 'bg-red-100 text-red-800 ring-red-600/20'
    default:
      return 'bg-slate-100 text-slate-700 ring-slate-500/20'
  }
}

export function coloresEventoCalendario(estado) {
  switch (estado) {
    case 'Agendado':
      return { backgroundColor: '#1d4ed8', borderColor: '#1e40af' }
    case 'Completado':
      return { backgroundColor: '#059669', borderColor: '#047857' }
    case 'Cancelado':
      return { backgroundColor: '#dc2626', borderColor: '#b91c1c' }
    default:
      return { backgroundColor: '#64748b', borderColor: '#475569' }
  }
}

export function citasDelDia(citas, fecha = obtenerFechaHoyISO()) {
  return citas
    .filter((cita) => cita.fecha === fecha)
    .sort((a, b) => a.horaInicio.localeCompare(b.horaInicio))
}

/** Objeto de cita para estado global; `tratamiento` es el subtítulo bajo el nombre del paciente. */
export function crearCitaAgendada({
  id,
  pacienteId,
  paciente,
  fecha,
  horaInicio,
  horaFin,
  tratamiento,
  estado = 'Agendado',
}) {
  return {
    id,
    pacienteId,
    paciente,
    fecha,
    horaInicio,
    horaFin,
    tratamiento,
    estado: normalizarEstadoCita(estado),
  }
}

/** Convierte fila del API (JOIN pacientes) al modelo usado por la UI. */
export function citaDesdeApi(fila, nombrePacienteFallback = '') {
  return crearCitaAgendada({
    id: fila.id,
    pacienteId: fila.paciente_id,
    paciente: fila.nombre_completo ?? nombrePacienteFallback ?? '',
    fecha: normalizarFechaCita(fila.fecha),
    horaInicio: normalizarHoraCita(fila.hora_inicio),
    horaFin: normalizarHoraCita(fila.hora_fin),
    tratamiento: fila.tratamiento ?? '',
    estado: fila.estado ?? 'Agendado',
  })
}

export function citaToEventoCalendario(cita) {
  return {
    id: cita.id,
    title: `${cita.paciente} — ${cita.tratamiento}`,
    start: combinarFechaHora(cita.fecha, cita.horaInicio),
    end: combinarFechaHora(cita.fecha, cita.horaFin),
    resource: cita,
  }
}
