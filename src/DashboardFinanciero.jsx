import { useEffect, useMemo, useState } from 'react'
import {
  AlertCircle,
  CalendarPlus,
  CheckCircle2,
  Clock,
  Stethoscope,
} from 'lucide-react'
import {
  citasDelDia,
  claseBadgeEstadoCita,
  citaDesdeApi,
  formatearHora12,
} from './citasCompartidas.js'
import { construirAlertasDashboard } from './dashboardAlertas.js'
import { cobroDesdeApi } from './finanzasMetricas.js'
import { headersApiAuth } from './apiAuthHeaders.js'

const API_CITAS_URL = 'https://emr-backend-7pt1.onrender.com/api/citas'
const API_FINANZAS_URL = 'https://emr-backend-7pt1.onrender.com/api/finanzas'

function DashboardFinanciero({ onIniciarConsulta, onAgendarCita }) {
  const [citas, setCitas] = useState([])
  const [finanzas, setFinanzas] = useState([])
  const [cargandoDatos, setCargandoDatos] = useState(true)

  useEffect(() => {
    let cancelado = false

    async function cargarResumenDashboard() {
      setCargandoDatos(true)
      try {
        const [responseCitas, responseFinanzas] = await Promise.all([
          fetch(API_CITAS_URL, { headers: headersApiAuth() }),
          fetch(API_FINANZAS_URL, { headers: headersApiAuth() }),
        ])

        if (!responseCitas.ok) {
          throw new Error('No se pudo cargar la agenda de citas')
        }
        if (!responseFinanzas.ok) {
          throw new Error('No se pudo cargar el resumen financiero')
        }

        const [dataCitas, dataFinanzas] = await Promise.all([
          responseCitas.json(),
          responseFinanzas.json(),
        ])

        if (cancelado) return

        const filasCitas = Array.isArray(dataCitas) ? dataCitas : []
        const filasFinanzas = Array.isArray(dataFinanzas) ? dataFinanzas : []

        setCitas(filasCitas.map((fila) => citaDesdeApi(fila)))
        setFinanzas(filasFinanzas.map((fila) => cobroDesdeApi(fila)))
      } catch {
        if (!cancelado) {
          setCitas([])
          setFinanzas([])
        }
      } finally {
        if (!cancelado) {
          setCargandoDatos(false)
        }
      }
    }

    cargarResumenDashboard()

    return () => {
      cancelado = true
    }
  }, [])

  const agendaHoy = useMemo(() => citasDelDia(citas), [citas])

  const alertasPendientes = useMemo(
    () => construirAlertasDashboard(citas, finanzas),
    [citas, finanzas],
  )

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-end gap-3">
        <button
          type="button"
          onClick={onAgendarCita}
          className="inline-flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 shadow-sm transition-colors hover:bg-slate-50"
        >
          <CalendarPlus className="h-4 w-4" aria-hidden="true" />
          + Agendar Cita
        </button>
        <button
          type="button"
          onClick={onIniciarConsulta}
          className="inline-flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white shadow-md transition-colors hover:bg-blue-700"
        >
          <Stethoscope className="h-4 w-4" aria-hidden="true" />
          + Iniciar Consulta
        </button>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <section className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm lg:col-span-2">
          <div className="mb-5 flex items-center gap-2">
            <Clock className="h-5 w-5 text-blue-600" aria-hidden="true" />
            <h3 className="text-lg font-semibold text-slate-900">Agenda del Día</h3>
          </div>
          {cargandoDatos ? (
            <p className="text-sm text-slate-500">Cargando agenda…</p>
          ) : agendaHoy.length === 0 ? (
            <p className="text-sm text-slate-500">No hay citas programadas para hoy.</p>
          ) : (
            <ul className="space-y-3">
              {agendaHoy.map((cita) => (
                <li
                  key={cita.id}
                  className="flex flex-col gap-3 rounded-lg border border-slate-100 bg-slate-50/80 p-4 sm:flex-row sm:items-center sm:justify-between"
                >
                  <div className="flex items-start gap-4">
                    <span className="whitespace-nowrap text-sm font-bold text-blue-800">
                      {formatearHora12(cita.horaInicio)}
                    </span>
                    <div>
                      <p className="font-semibold text-slate-900">{cita.paciente}</p>
                      <p className="text-sm text-slate-600">{cita.tratamiento}</p>
                    </div>
                  </div>
                  <span
                    className={`inline-flex w-fit items-center rounded-full px-2.5 py-0.5 text-xs font-medium ring-1 ring-inset ${claseBadgeEstadoCita(cita.estado)}`}
                  >
                    {cita.estado}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </section>

        <section className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm lg:col-span-1">
          <div className="mb-5 flex items-center gap-2">
            <AlertCircle className="h-5 w-5 text-amber-600" aria-hidden="true" />
            <h3 className="text-lg font-semibold text-slate-900">
              Alertas y Pendientes
            </h3>
          </div>
          {cargandoDatos ? (
            <p className="text-sm text-slate-500">Calculando alertas…</p>
          ) : (
            <ul className="space-y-3">
              {alertasPendientes.map((item) => {
                const Icono = item.icon
                return (
                  <li
                    key={item.id}
                    className="flex items-start gap-3 rounded-lg border border-slate-100 p-3 transition-colors hover:bg-slate-50"
                  >
                    <div
                      className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-lg ${item.iconClass}`}
                    >
                      <Icono className="h-4 w-4" aria-hidden="true" />
                    </div>
                    <p className="text-sm font-medium leading-snug text-slate-700">
                      {item.texto}
                    </p>
                  </li>
                )
              })}
            </ul>
          )}
          <div className="mt-5 flex items-center gap-2 rounded-lg bg-slate-50 px-3 py-2 text-xs font-medium text-slate-600">
            <CheckCircle2 className="h-4 w-4 shrink-0 text-slate-500" aria-hidden="true" />
            Actualizado en tiempo real según citas y cobros
          </div>
        </section>
      </div>
    </div>
  )
}

export default DashboardFinanciero
