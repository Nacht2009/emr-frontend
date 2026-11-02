import { useEffect, useState } from 'react'
import { formatearFechaPostgres } from './fechas.js'
import { resolverUuidPaciente } from './pacienteUuid.js'
import { headersApiAuth } from './apiAuthHeaders.js'

const API_CONSULTAS_URL = 'https://emr-backend-7pt1.onrender.com/api/consultas'

function IconoDocumento({ className }) {
  return (
    <svg
      className={className}
      xmlns="http://www.w3.org/2000/svg"
      fill="none"
      viewBox="0 0 24 24"
      strokeWidth={1.5}
      stroke="currentColor"
      aria-hidden="true"
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M19.5 14.25v-2.625a3.375 3.375 0 0 0-3.375-3.375h-1.5A1.125 1.125 0 0 1 13.5 7.125v-1.5a3.375 3.375 0 0 0-3.375-3.375H8.25m2.25 0H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 0 0-9-9Z"
      />
    </svg>
  )
}

function PerfilPaciente({
  paciente,
  estadoBadgeStyles,
  onVolver,
  onNuevaConsulta,
  onVerEditarConsulta,
  recargaHistorialToken = 0,
}) {
  const [historialConsultas, setHistorialConsultas] = useState([])
  const [cargandoHistorial, setCargandoHistorial] = useState(false)

  useEffect(() => {
    const pacienteUuid = resolverUuidPaciente(paciente)
    if (!pacienteUuid) {
      setHistorialConsultas([])
      return
    }

    let cancelado = false

    async function cargarHistorial() {
      setCargandoHistorial(true)
      try {
        const response = await fetch(
          `${API_CONSULTAS_URL}/${encodeURIComponent(pacienteUuid)}`,
          { headers: headersApiAuth() },
        )
        if (!response.ok) {
          throw new Error('No se pudo cargar el historial de consultas')
        }

        const data = await response.json()
        if (!cancelado) {
          setHistorialConsultas(Array.isArray(data) ? data : [])
        }
      } catch {
        if (!cancelado) {
          setHistorialConsultas([])
        }
      } finally {
        if (!cancelado) {
          setCargandoHistorial(false)
        }
      }
    }

    cargarHistorial()

    return () => {
      cancelado = true
    }
  }, [paciente, recargaHistorialToken])

  if (!paciente) {
    return (
      <div className="rounded-xl border border-slate-200 bg-white p-8 text-center text-slate-600">
        <p>No se encontró el paciente seleccionado.</p>
        <button
          type="button"
          onClick={onVolver}
          className="mt-4 text-sm font-semibold text-blue-800 hover:underline"
        >
          Volver a Pacientes
        </button>
      </div>
    )
  }

  const filasDatos = [
    { etiqueta: 'Nombre completo', valor: paciente.nombre_completo },
    { etiqueta: 'Edad', valor: `${paciente.edad} años` },
    { etiqueta: 'Peso', valor: paciente.peso ?? '—' },
    { etiqueta: 'Altura', valor: paciente.altura ?? '—' },
    { etiqueta: 'Cédula', valor: paciente.documento_identidad ?? '—' },
    { etiqueta: 'Estado actual', valor: paciente.estado, esEstado: true },
  ]

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">
            Expediente digital
          </p>
          <h3 className="mt-1 text-2xl font-bold text-slate-900">
            Perfil del Paciente
          </h3>
          <p className="mt-1 text-sm text-slate-600">
            ID: {paciente.codigo_visual ?? paciente.id}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <button
            type="button"
            onClick={() => onNuevaConsulta(paciente)}
            className="rounded-lg bg-blue-600 px-5 py-2.5 text-sm font-semibold text-white shadow-md transition-colors hover:bg-blue-700"
          >
            Nueva Consulta
          </button>
          <button
            type="button"
            onClick={onVolver}
            className="rounded-lg border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-700 shadow-sm transition-colors hover:bg-slate-50"
          >
            ← Volver a Pacientes
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-[minmax(280px,320px)_1fr]">
        <aside className="h-fit rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
          <h4 className="border-b border-slate-100 pb-3 text-sm font-bold uppercase tracking-wide text-slate-700">
            Datos generales
          </h4>
          <dl className="mt-4 space-y-4">
            {filasDatos.map((fila) => (
              <div key={fila.etiqueta}>
                <dt className="text-xs font-medium uppercase tracking-wide text-slate-500">
                  {fila.etiqueta}
                </dt>
                <dd className="mt-1 text-sm font-semibold text-slate-900">
                  {fila.esEstado ? (
                    <span
                      className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ring-1 ring-inset ${
                        estadoBadgeStyles[fila.valor] ??
                        'bg-slate-50 text-slate-600 ring-slate-500/20'
                      }`}
                    >
                      {fila.valor}
                    </span>
                  ) : (
                    fila.valor
                  )}
                </dd>
              </div>
            ))}
          </dl>
        </aside>

        <section className="rounded-xl border border-slate-200 bg-white shadow-sm">
          <div className="border-b border-slate-100 px-6 py-4">
            <h4 className="text-sm font-bold uppercase tracking-wide text-slate-700">
              Historial de consultas
            </h4>
            <p className="mt-1 text-sm text-slate-500">
              Registro cronológico del paciente (más recientes primero)
            </p>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full min-w-[560px] border-collapse text-left">
              <thead>
                <tr className="border-b border-slate-200 bg-slate-50">
                  <th className="px-6 py-3 text-xs font-bold uppercase tracking-wider text-slate-600">
                    Fecha
                  </th>
                  <th className="px-6 py-3 text-xs font-bold uppercase tracking-wider text-slate-600">
                    Motivo de la consulta
                  </th>
                  <th className="px-6 py-3 text-xs font-bold uppercase tracking-wider text-slate-600">
                    Acciones
                  </th>
                </tr>
              </thead>
              <tbody>
                {cargandoHistorial ? (
                  <tr>
                    <td
                      colSpan={3}
                      className="px-6 py-10 text-center text-sm text-slate-500"
                    >
                      Cargando historial...
                    </td>
                  </tr>
                ) : historialConsultas.length === 0 ? (
                  <tr>
                    <td
                      colSpan={3}
                      className="px-6 py-10 text-center text-sm text-slate-500"
                    >
                      No hay consultas registradas.
                    </td>
                  </tr>
                ) : (
                  historialConsultas.map((consulta, indice) => (
                    <tr
                      key={consulta.id ?? `${consulta.fecha_consulta}-${indice}`}
                      className={`border-b border-slate-100 last:border-b-0 ${
                        indice % 2 === 0 ? 'bg-white' : 'bg-slate-50/80'
                      }`}
                    >
                      <td className="whitespace-nowrap px-6 py-4 text-sm font-medium text-slate-800">
                        {formatearFechaPostgres(consulta.fecha_consulta)}
                      </td>
                      <td className="px-6 py-4 text-sm text-slate-700">
                        {consulta.motivo_consulta}
                      </td>
                      <td className="whitespace-nowrap px-6 py-4">
                        <button
                          type="button"
                          onClick={() => onVerEditarConsulta(paciente, consulta)}
                          className="inline-flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-blue-800 transition-colors hover:bg-blue-50"
                        >
                          <IconoDocumento className="h-4 w-4 shrink-0" />
                          Ver / Editar
                        </button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </section>
      </div>
    </div>
  )
}

export default PerfilPaciente
