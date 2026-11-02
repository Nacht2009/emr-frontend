import { useMemo } from 'react'
import {
  Activity,
  CalendarCheck,
  TrendingDown,
  UserPlus,
  Users,
} from 'lucide-react'
import {
  actividadRecienteCompletadas,
  agruparPacientesPorRangoEdad,
  contarCitasMesActual,
  contarNuevosPacientesMesActual,
  contarTratamientosActivos,
  formatearTasaCancelacion,
} from './reportesMetricas.js'

const KPI_DEFINICIONES = [
  {
    id: 'total-pacientes',
    label: 'Total de Pacientes',
    icon: Users,
    iconClass: 'bg-blue-100 text-blue-700',
  },
  {
    id: 'citas-mes',
    label: 'Citas este Mes',
    icon: CalendarCheck,
    iconClass: 'bg-emerald-100 text-emerald-700',
  },
  {
    id: 'tratamientos-activos',
    label: 'Tratamientos Activos',
    icon: Activity,
    iconClass: 'bg-amber-100 text-amber-700',
  },
  {
    id: 'tasa-cancelacion',
    label: 'Tasa de Cancelación',
    icon: TrendingDown,
    iconClass: 'bg-rose-100 text-rose-700',
  },
]

function formatearFechaCorta(fechaISO) {
  if (!fechaISO) return '—'
  const ms = Date.parse(`${fechaISO}T12:00:00`)
  if (Number.isNaN(ms)) return fechaISO
  return new Date(ms).toLocaleDateString('es-ES', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  })
}

function ReportesEstadisticas({ pacientes = [], citas = [] }) {
  const kpis = useMemo(() => {
    const totalPacientes = pacientes.length
    const citasMes = contarCitasMesActual(citas)
    const tratamientosActivos = contarTratamientosActivos(pacientes)
    const tasaCancelacion = formatearTasaCancelacion(citas)

    const valores = {
      'total-pacientes': String(totalPacientes),
      'citas-mes': String(citasMes),
      'tratamientos-activos': String(tratamientosActivos),
      'tasa-cancelacion': tasaCancelacion,
    }

    return KPI_DEFINICIONES.map((def) => ({
      ...def,
      value: valores[def.id],
    }))
  }, [pacientes, citas])

  const pacientesPorRangoEdad = useMemo(
    () => agruparPacientesPorRangoEdad(pacientes),
    [pacientes],
  )

  const nuevosPacientesMes = useMemo(
    () => contarNuevosPacientesMesActual(pacientes),
    [pacientes],
  )

  const actividadReciente = useMemo(
    () => actividadRecienteCompletadas(citas, 3),
    [citas],
  )

  const maxPorcentajeEdad = useMemo(() => {
    if (pacientesPorRangoEdad.length === 0) return 0
    return Math.max(...pacientesPorRangoEdad.map((item) => item.porcentaje), 0)
  }, [pacientesPorRangoEdad])

  return (
    <div className="space-y-8">
      <section className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {kpis.map((kpi) => {
          const Icono = kpi.icon
          return (
            <article
              key={kpi.id}
              className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm"
            >
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                    {kpi.label}
                  </p>
                  <p className="mt-2 text-3xl font-bold text-slate-900">
                    {kpi.value}
                  </p>
                  {kpi.id === 'tasa-cancelacion' && citas.length === 0 && (
                    <p className="mt-1 text-xs text-slate-500">Sin citas registradas</p>
                  )}
                </div>
                <div
                  className={`flex h-10 w-10 items-center justify-center rounded-lg ${kpi.iconClass}`}
                >
                  <Icono className="h-5 w-5" aria-hidden="true" />
                </div>
              </div>
            </article>
          )
        })}
      </section>

      <section className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <article className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
          <h3 className="text-lg font-semibold text-slate-900">
            Distribución de Pacientes por Rango de Edad
          </h3>
          <p className="mt-1 text-sm text-slate-500">
            Composición demográfica de la cartera activa
          </p>

          <div className="mt-5 flex items-center gap-3 rounded-lg border border-blue-100 bg-blue-50 px-4 py-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-blue-100 text-blue-700">
              <UserPlus className="h-5 w-5" aria-hidden="true" />
            </div>
            <div>
              <p className="text-xs font-semibold uppercase tracking-wide text-blue-800">
                Nuevos pacientes este mes
              </p>
              <p className="text-2xl font-bold text-blue-900">{nuevosPacientesMes}</p>
            </div>
          </div>

          {pacientesPorRangoEdad.length === 0 ? (
            <p className="mt-6 text-sm text-slate-500">
              No hay pacientes registrados para calcular esta métrica.
            </p>
          ) : (
            <ul className="mt-6 space-y-4">
              {pacientesPorRangoEdad.map((item) => {
                const anchoBarra =
                  maxPorcentajeEdad > 0
                    ? (item.porcentaje / maxPorcentajeEdad) * 100
                    : 0
                return (
                  <li key={item.rango}>
                    <div className="mb-1.5 flex items-center justify-between text-sm">
                      <span className="font-medium text-slate-800">{item.rango}</span>
                      <span className="text-slate-600">
                        {item.porcentaje}% ({item.pacientes})
                      </span>
                    </div>
                    <div className="h-2 overflow-hidden rounded-full bg-slate-100">
                      <div
                        className="h-full rounded-full bg-blue-600 transition-all"
                        style={{ width: `${anchoBarra}%` }}
                      />
                    </div>
                  </li>
                )
              })}
            </ul>
          )}
        </article>

        <article className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
          <h3 className="text-lg font-semibold text-slate-900">
            Actividad Reciente
          </h3>
          <p className="mt-1 text-sm text-slate-500">
            Últimas citas completadas
          </p>
          <div className="mt-6">
            <table className="w-full table-fixed border-collapse text-left text-sm">
              <thead>
                <tr className="border-b border-slate-200 text-xs uppercase tracking-wide text-slate-500">
                  <th className="w-[34%] pb-3 pr-2 font-semibold">Paciente</th>
                  <th className="w-[26%] pb-3 pr-2 font-semibold">Fecha</th>
                  <th className="w-[40%] pb-3 font-semibold">Tratamiento</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {actividadReciente.length === 0 ? (
                  <tr>
                    <td colSpan={3} className="py-4 text-sm text-slate-500">
                      No hay citas completadas registradas.
                    </td>
                  </tr>
                ) : (
                  actividadReciente.map((fila) => (
                    <tr key={fila.id} className="text-slate-700">
                      <td
                        className="truncate py-3 pr-2 font-medium text-slate-900"
                        title={fila.paciente}
                      >
                        {fila.paciente}
                      </td>
                      <td className="whitespace-nowrap py-3 pr-2">
                        {formatearFechaCorta(fila.fecha)}
                      </td>
                      <td
                        className="truncate py-3 text-slate-600"
                        title={fila.motivo}
                      >
                        {fila.motivo}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </article>
      </section>
    </div>
  )
}

export default ReportesEstadisticas
