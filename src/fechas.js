export function formatearFechaPostgres(fecha) {
  if (fecha == null || fecha === '') return '—'
  const fechaObj = new Date(fecha)
  if (Number.isNaN(fechaObj.getTime())) return String(fecha)
  return fechaObj.toLocaleDateString('es-ES')
}

export function fechaPostgresAInputDate(fecha) {
  if (fecha == null || fecha === '') return ''
  const fechaObj = new Date(fecha)
  if (Number.isNaN(fechaObj.getTime())) {
    if (typeof fecha === 'string' && /^\d{4}-\d{2}-\d{2}/.test(fecha)) {
      return fecha.slice(0, 10)
    }
    return ''
  }
  const year = fechaObj.getFullYear()
  const month = String(fechaObj.getMonth() + 1).padStart(2, '0')
  const day = String(fechaObj.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}
