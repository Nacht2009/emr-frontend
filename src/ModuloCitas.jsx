import { useCallback, useEffect, useMemo, useState } from 'react'
import { Check, ChevronDown, Pencil, X } from 'lucide-react'
import { Calendar, dateFnsLocalizer } from 'react-big-calendar'
import format from 'date-fns/format'
import parse from 'date-fns/parse'
import startOfWeek from 'date-fns/startOfWeek'
import getDay from 'date-fns/getDay'
import { es } from 'date-fns/locale'
import toast from 'react-hot-toast'
import 'react-big-calendar/lib/css/react-big-calendar.css'
import {
  ESTADOS_CITA,
  citasDelDia,
  claseBadgeEstadoCita,
  coloresEventoCalendario,
  combinarFechaHora,
  citaDesdeApi,
  citaToEventoCalendario,
  formatearHora12,
  esEstadoCitaValido,
  TRATAMIENTOS_ODONTOLOGICOS,
  esTratamientoCatalogo,
  crearCitaAgendada,
  normalizarEstadoCita,
  obtenerFechaHoyISO,
} from './citasCompartidas.js'
import { esCodigoVisualPaciente, resolverUuidPaciente } from './pacienteUuid.js'
import { headersApiAuth, headersApiJson } from './apiAuthHeaders.js'

const API_CITAS_URL = 'https://emr-backend-7pt1.onrender.com/api/citas'

const locales = { es }

const localizer = dateFnsLocalizer({
  format,
  parse,
  startOfWeek: () => startOfWeek(new Date(), { weekStartsOn: 1 }),
  getDay,
  locales,
})

const MENSAJES_CALENDARIO = {
  today: 'Hoy',
  previous: 'Anterior',
  next: 'Siguiente',
  month: 'Mes',
  week: 'Semana',
  day: 'Día',
  agenda: 'Agenda',
  date: 'Fecha',
  time: 'Hora',
  event: 'Cita',
  noEventsInRange: 'No hay citas en este rango.',
  showMore: (total) => `+${total} más`,
}

const FORM_CITA_VACIO = {
  busquedaPaciente: '',
  pacienteId: '',
  pacienteNombre: '',
  fecha: obtenerFechaHoyISO(),
  horaInicio: '09:00',
  horaFin: '10:00',
  tratamiento: '',
}

function formularioDesdeCita(cita) {
  return {
    busquedaPaciente: cita.paciente,
    pacienteId: cita.pacienteId,
    pacienteNombre: cita.paciente,
    fecha: cita.fecha,
    horaInicio: cita.horaInicio,
    horaFin: cita.horaFin,
    tratamiento: esTratamientoCatalogo(cita.tratamiento) ? cita.tratamiento : '',
  }
}

const VISTAS_CALENDARIO = [
  { id: 'month', label: 'Mes' },
  { id: 'week', label: 'Semana' },
  { id: 'day', label: 'Día' },
  { id: 'agenda', label: 'Agenda' },
]

const claseBotonNav =
  'rounded-md border border-slate-200 bg-white px-3 py-1.5 text-sm font-medium text-slate-700 transition-colors hover:bg-slate-50'

function TarjetaCitaInteractiva({
  cita,
  menuAbierto,
  onToggleMenuEstado,
  onCambiarEstado,
  onEditar,
}) {
  const cancelada = cita.estado === 'Cancelado'

  return (
    <li
      className={`flex flex-col gap-3 rounded-lg border border-slate-100 bg-slate-50/80 px-3 py-2.5 sm:flex-row sm:items-center sm:justify-between ${
        cancelada ? 'opacity-80' : ''
      }`}
    >
      <div className="flex min-w-0 flex-1 items-start gap-3">
        <span className="whitespace-nowrap text-sm font-bold text-blue-800">
          {formatearHora12(cita.horaInicio)}
        </span>
        <div className="min-w-0">
          <p
            className={`text-sm font-semibold text-slate-900 ${cancelada ? 'line-through decoration-slate-400' : ''}`}
          >
            {cita.paciente}
          </p>
          <p className="text-xs text-slate-600">{cita.tratamiento}</p>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-2 sm:justify-end">
        <button
          type="button"
          title="Editar cita"
          onClick={() => onEditar(cita)}
          className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-600 transition-colors hover:bg-slate-100 hover:text-slate-900"
        >
          <Pencil className="h-4 w-4" aria-hidden="true" />
          <span className="sr-only">Editar cita</span>
        </button>

        {cita.estado === 'Agendado' && (
          <div
            className="flex items-center gap-1"
            role="group"
            aria-label="Acciones rápidas de la cita"
          >
            <button
              type="button"
              title="Marcar como completada"
              onClick={() => onCambiarEstado(cita.id, 'Completado')}
              className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-emerald-200 bg-emerald-50 text-emerald-700 transition-colors hover:bg-emerald-100"
            >
              <Check className="h-4 w-4" aria-hidden="true" />
              <span className="sr-only">Completar cita</span>
            </button>
            <button
              type="button"
              title="Cancelar cita"
              onClick={() => onCambiarEstado(cita.id, 'Cancelado')}
              className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-red-200 bg-red-50 text-red-700 transition-colors hover:bg-red-100"
            >
              <X className="h-4 w-4" aria-hidden="true" />
              <span className="sr-only">Cancelar cita</span>
            </button>
          </div>
        )}

        <div className="relative" data-cita-estado-menu>
          <button
            type="button"
            onClick={() => onToggleMenuEstado(cita.id)}
            aria-expanded={menuAbierto}
            aria-haspopup="listbox"
            className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-medium ring-1 ring-inset transition-opacity hover:opacity-90 ${claseBadgeEstadoCita(cita.estado)}`}
          >
            {cita.estado}
            <ChevronDown className="h-3 w-3 opacity-70" aria-hidden="true" />
          </button>

          {menuAbierto && (
            <ul
              role="listbox"
              aria-label="Cambiar estado de la cita"
              className="absolute right-0 z-20 mt-1 min-w-[10.5rem] overflow-hidden rounded-lg border border-slate-200 bg-white py-1 shadow-lg"
            >
              {ESTADOS_CITA.map((estado) => {
                const activo = cita.estado === estado
                return (
                  <li key={estado} role="option" aria-selected={activo}>
                    <button
                      type="button"
                      disabled={activo}
                      onClick={() => onCambiarEstado(cita.id, estado)}
                      className={`flex w-full items-center justify-between px-3 py-2 text-left text-sm transition-colors hover:bg-slate-50 disabled:cursor-default disabled:opacity-60 ${
                        activo ? 'font-semibold text-slate-900' : 'text-slate-700'
                      }`}
                    >
                      <span
                        className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ring-1 ring-inset ${claseBadgeEstadoCita(estado)}`}
                      >
                        {estado}
                      </span>
                      {activo && (
                        <Check className="h-3.5 w-3.5 text-slate-500" aria-hidden="true" />
                      )}
                    </button>
                  </li>
                )
              })}
            </ul>
          )}
        </div>
      </div>
    </li>
  )
}

function BarraToolbarCalendario({ label, onNavigate, vistaActiva, onCambiarVista }) {
  return (
    <div className="mb-4 space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap gap-2">
          <button type="button" className={claseBotonNav} onClick={() => onNavigate('TODAY')}>
            Hoy
          </button>
          <button type="button" className={claseBotonNav} onClick={() => onNavigate('PREV')}>
            Anterior
          </button>
          <button type="button" className={claseBotonNav} onClick={() => onNavigate('NEXT')}>
            Siguiente
          </button>
        </div>
        <p className="text-sm font-semibold capitalize text-slate-800">{label}</p>
      </div>

      <div
        className="inline-flex flex-wrap gap-1 rounded-lg border border-slate-200 bg-slate-100 p-1"
        role="tablist"
        aria-label="Vista del calendario"
      >
        {VISTAS_CALENDARIO.map((vista) => {
          const activa = vistaActiva === vista.id
          return (
            <button
              key={vista.id}
              type="button"
              role="tab"
              aria-selected={activa}
              onClick={() => onCambiarVista(vista.id)}
              className={`rounded-md px-4 py-2 text-sm font-semibold transition-colors ${
                activa
                  ? 'bg-blue-600 text-white shadow-sm'
                  : 'text-slate-600 hover:bg-white hover:text-slate-900'
              }`}
            >
              {vista.label}
            </button>
          )
        })}
      </div>
    </div>
  )
}

function ModuloCitas({
  pacientes,
  citas,
  setCitas,
  abrirModalInicial = false,
  onModalInicialConsumido,
}) {
  const [vistaActiva, setVistaActiva] = useState('week')
  const [fechaCalendario, setFechaCalendario] = useState(
    () => combinarFechaHora(obtenerFechaHoyISO(), '08:00'),
  )
  const [modalAbierto, setModalAbierto] = useState(false)
  const [formCita, setFormCita] = useState({ ...FORM_CITA_VACIO })
  const [guardandoCita, setGuardandoCita] = useState(false)
  const [menuEstadoCitaId, setMenuEstadoCitaId] = useState(null)
  const [citaIdEnEdicion, setCitaIdEnEdicion] = useState(null)

  const modoEdicion = Boolean(citaIdEnEdicion)

  const eventos = useMemo(
    () => citas.map(citaToEventoCalendario),
    [citas],
  )

  const agendaHoy = useMemo(() => citasDelDia(citas), [citas])

  const cambiarEstadoCita = useCallback(
    async (citaId, nuevoEstado) => {
      if (typeof setCitas !== 'function') {
        toast.error('No se pudo actualizar la cita')
        return
      }
      const estadoNormalizado = normalizarEstadoCita(nuevoEstado)
      if (!esEstadoCitaValido(estadoNormalizado)) return

      const actual = citas.find((c) => c.id === citaId)
      if (!actual || actual.estado === estadoNormalizado) return

      try {
        const response = await fetch(
          `${API_CITAS_URL}/${encodeURIComponent(citaId)}/estado`,
          {
            method: 'PUT',
            headers: headersApiJson(),
            body: JSON.stringify({ estado: estadoNormalizado }),
          },
        )

        let data = null
        try {
          data = await response.json()
        } catch {
          data = null
        }

        if (!response.ok) {
          throw new Error(
            (data && data.error) || 'No se pudo actualizar el estado de la cita',
          )
        }

        const citaActualizada = citaDesdeApi(data, actual.paciente)
        setCitas((prev) =>
          prev.map((c) => (c.id === citaId ? citaActualizada : c)),
        )
        setMenuEstadoCitaId(null)
        toast.success(`Estado actualizado: ${estadoNormalizado}`)
      } catch (error) {
        toast.error(
          error?.message || 'No se pudo actualizar el estado de la cita',
        )
      }
    },
    [citas, setCitas],
  )

  useEffect(() => {
    if (!menuEstadoCitaId) return undefined
    const cerrarSiClickFuera = (evento) => {
      if (!evento.target.closest('[data-cita-estado-menu]')) {
        setMenuEstadoCitaId(null)
      }
    }
    document.addEventListener('mousedown', cerrarSiClickFuera)
    return () => document.removeEventListener('mousedown', cerrarSiClickFuera)
  }, [menuEstadoCitaId])

  const pacientesFiltradosModal = useMemo(() => {
    const termino = formCita.busquedaPaciente.trim().toLowerCase()
    if (!termino) return pacientes.slice(0, 6)
    return pacientes.filter((p) => {
      const uuid = resolverUuidPaciente(p) ?? ''
      const codigo = String(p.codigo_visual ?? '').toLowerCase()
      return (
        p.nombre_completo.toLowerCase().includes(termino) ||
        uuid.toLowerCase().includes(termino) ||
        codigo.includes(termino) ||
        p.documento_identidad?.toLowerCase().includes(termino)
      )
    })
  }, [formCita.busquedaPaciente, pacientes])

  const abrirModalAgendar = () => {
    setCitaIdEnEdicion(null)
    setFormCita({ ...FORM_CITA_VACIO })
    setModalAbierto(true)
  }

  const abrirModalEditar = (cita) => {
    setMenuEstadoCitaId(null)
    setCitaIdEnEdicion(cita.id)
    setFormCita(formularioDesdeCita(cita))
    setModalAbierto(true)
  }

  useEffect(() => {
    if (!abrirModalInicial) return
    abrirModalAgendar()
    onModalInicialConsumido?.()
  }, [abrirModalInicial, onModalInicialConsumido])

  const cerrarModal = () => {
    if (guardandoCita) return
    setModalAbierto(false)
    setCitaIdEnEdicion(null)
    setFormCita({ ...FORM_CITA_VACIO })
  }

  const seleccionarPaciente = (paciente) => {
    const uuid = resolverUuidPaciente(paciente)
    if (!uuid || esCodigoVisualPaciente(uuid)) {
      toast.error('No se pudo resolver el UUID del paciente')
      return
    }
    setFormCita((prev) => ({
      ...prev,
      pacienteId: uuid,
      pacienteNombre: paciente.nombre_completo,
      busquedaPaciente: paciente.nombre_completo,
    }))
  }

  const actualizarFormCita = (campo, valor) => {
    setFormCita((prev) => ({ ...prev, [campo]: valor }))
  }

  const guardarCita = async (e) => {
    e.preventDefault()
    if (!formCita.pacienteId) {
      toast.error('Seleccione un paciente de la lista')
      return
    }
    if (!esTratamientoCatalogo(formCita.tratamiento)) {
      toast.error('Seleccione un tratamiento del catálogo')
      return
    }

    if (typeof setCitas !== 'function') {
      toast.error('No se pudo guardar la cita')
      return
    }

    const inicio = combinarFechaHora(formCita.fecha, formCita.horaInicio)
    const fin = combinarFechaHora(formCita.fecha, formCita.horaFin)
    if (fin <= inicio) {
      toast.error('La hora de fin debe ser posterior a la hora de inicio')
      return
    }

    if (esCodigoVisualPaciente(formCita.pacienteId)) {
      toast.error('Seleccione un paciente válido de la lista')
      return
    }

    setGuardandoCita(true)
    try {
      if (modoEdicion) {
        const citaExistente = citas.find((c) => c.id === citaIdEnEdicion)
        if (!citaExistente) {
          toast.error('No se encontró la cita a editar')
          return
        }

        const citaActualizada = crearCitaAgendada({
          id: citaIdEnEdicion,
          pacienteId: formCita.pacienteId,
          paciente: formCita.pacienteNombre,
          fecha: formCita.fecha,
          horaInicio: formCita.horaInicio,
          horaFin: formCita.horaFin,
          tratamiento: formCita.tratamiento,
          estado: citaExistente.estado,
        })

        setCitas((prev) =>
          prev.map((c) => (c.id === citaIdEnEdicion ? citaActualizada : c)),
        )
        setFechaCalendario(
          combinarFechaHora(citaActualizada.fecha, citaActualizada.horaInicio),
        )
        toast.success('Cita actualizada correctamente')
      } else {
        const response = await fetch(API_CITAS_URL, {
          method: 'POST',
          headers: headersApiJson(),
          body: JSON.stringify({
            paciente_id: formCita.pacienteId,
            fecha: formCita.fecha,
            hora_inicio: formCita.horaInicio,
            hora_fin: formCita.horaFin,
            tratamiento: formCita.tratamiento,
          }),
        })

        let data = null
        try {
          data = await response.json()
        } catch {
          data = null
        }

        if (!response.ok) {
          throw new Error(
            (data && data.error) || 'No se pudo agendar la cita en el servidor',
          )
        }

        const nuevaCita = citaDesdeApi(data, formCita.pacienteNombre)
        setCitas((prev) => [...prev, nuevaCita])
        setFechaCalendario(
          combinarFechaHora(nuevaCita.fecha, nuevaCita.horaInicio),
        )
        toast.success('Cita agendada correctamente')
      }

      cerrarModal()
    } catch (error) {
      toast.error(error?.message || 'No se pudo guardar la cita')
    } finally {
      setGuardandoCita(false)
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <button
          type="button"
          onClick={abrirModalAgendar}
          className="rounded-lg bg-blue-600 px-5 py-2.5 text-sm font-semibold text-white shadow-md transition-colors hover:bg-blue-700"
        >
          Agendar cita nueva
        </button>
      </div>

      <section className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
        <h4 className="text-sm font-semibold text-slate-900">Citas del día</h4>
        <p className="mt-0.5 text-xs text-slate-500">
          Toque el estado o use ✓ / ✕ para actualizar. Los cambios se reflejan al
          instante en el Dashboard.
        </p>
        {agendaHoy.length === 0 ? (
          <p className="mt-3 text-sm text-slate-500">No hay citas para hoy.</p>
        ) : (
          <ul className="mt-3 space-y-2">
            {agendaHoy.map((cita) => (
              <TarjetaCitaInteractiva
                key={cita.id}
                cita={cita}
                menuAbierto={menuEstadoCitaId === cita.id}
                onToggleMenuEstado={(id) =>
                  setMenuEstadoCitaId((prev) => (prev === id ? null : id))
                }
                onCambiarEstado={cambiarEstadoCita}
                onEditar={abrirModalEditar}
              />
            ))}
          </ul>
        )}
      </section>

      <div className="overflow-hidden rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
        <div className="mb-3 flex flex-wrap gap-4 text-xs text-slate-600">
          {ESTADOS_CITA.map((estado) => {
            const colores = coloresEventoCalendario(estado)
            return (
              <span key={estado} className="inline-flex items-center gap-2">
                <span
                  className="h-3 w-3 rounded"
                  style={{ backgroundColor: colores.backgroundColor }}
                />
                {estado}
              </span>
            )
          })}
        </div>
        <div className="h-[min(72vh,720px)] min-h-[480px]">
          <Calendar
            localizer={localizer}
            culture="es"
            messages={MENSAJES_CALENDARIO}
            events={eventos}
            startAccessor="start"
            endAccessor="end"
            views={['month', 'week', 'day', 'agenda']}
            view={vistaActiva}
            onView={setVistaActiva}
            date={fechaCalendario}
            onNavigate={setFechaCalendario}
            components={{
              toolbar: (toolbarProps) => (
                <BarraToolbarCalendario
                  label={toolbarProps.label}
                  onNavigate={toolbarProps.onNavigate}
                  vistaActiva={vistaActiva}
                  onCambiarVista={setVistaActiva}
                />
              ),
            }}
            popup
            selectable
            onSelectSlot={({ start }) => {
              setCitaIdEnEdicion(null)
              setFormCita({
                ...FORM_CITA_VACIO,
                fecha: format(start, 'yyyy-MM-dd'),
                horaInicio: format(start, 'HH:mm'),
                horaFin: format(
                  new Date(start.getTime() + 60 * 60 * 1000),
                  'HH:mm',
                ),
              })
              setModalAbierto(true)
            }}
            eventPropGetter={(event) => {
              const colores = coloresEventoCalendario(event.resource?.estado)
              return {
                style: {
                  backgroundColor: colores.backgroundColor,
                  borderColor: colores.borderColor,
                  color: '#fff',
                  fontSize: '0.75rem',
                  borderRadius: '6px',
                },
              }
            }}
          />
        </div>
      </div>

      {modalAbierto && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4"
          role="dialog"
          aria-modal="true"
          aria-labelledby="modal-cita-titulo"
        >
          <div className="max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-2xl border border-slate-200 bg-white shadow-2xl">
            <div className="border-b border-slate-100 px-6 py-4">
              <h4
                id="modal-cita-titulo"
                className="text-lg font-bold text-slate-900"
              >
                {modoEdicion ? 'Editar cita' : 'Agendar cita nueva'}
              </h4>
              <p className="mt-1 text-sm text-slate-500">
                {modoEdicion
                  ? 'Modifique los datos de la cita. El estado se conserva hasta que lo cambie en la lista.'
                  : 'Complete los datos para registrar la cita en el calendario.'}
              </p>
            </div>

            <form onSubmit={guardarCita} className="space-y-4 px-6 py-5">
              <div>
                <label className="mb-1.5 block text-sm font-medium text-slate-700">
                  Buscar paciente
                </label>
                <input
                  type="search"
                  value={formCita.busquedaPaciente}
                  onChange={(e) =>
                    actualizarFormCita('busquedaPaciente', e.target.value)
                  }
                  placeholder="Nombre, ID o documento..."
                  className="w-full rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
                />
                {formCita.pacienteId && (
                  <p className="mt-2 text-xs font-medium text-emerald-700">
                    Seleccionado: {formCita.pacienteNombre} ({formCita.pacienteId})
                  </p>
                )}
                <ul className="mt-2 max-h-36 overflow-y-auto rounded-lg border border-slate-100">
                  {pacientesFiltradosModal.length === 0 ? (
                    <li className="px-3 py-2 text-sm text-slate-500">
                      Sin coincidencias
                    </li>
                  ) : (
                    pacientesFiltradosModal.map((paciente) => (
                      <li key={paciente.id}>
                        <button
                          type="button"
                          onClick={() => seleccionarPaciente(paciente)}
                          className={`w-full px-3 py-2 text-left text-sm transition-colors hover:bg-blue-50 ${
                            formCita.pacienteId === resolverUuidPaciente(paciente)
                              ? 'bg-blue-50 font-semibold text-blue-900'
                              : 'text-slate-700'
                          }`}
                        >
                          {paciente.nombre_completo}
                          <span className="ml-2 text-xs text-slate-500">
                            {paciente.codigo_visual ?? resolverUuidPaciente(paciente)}
                          </span>
                        </button>
                      </li>
                    ))
                  )}
                </ul>
              </div>

              <div>
                <label
                  htmlFor="cita-fecha"
                  className="mb-1.5 block text-sm font-medium text-slate-700"
                >
                  Fecha
                </label>
                <input
                  id="cita-fecha"
                  type="date"
                  required
                  value={formCita.fecha}
                  onChange={(e) => actualizarFormCita('fecha', e.target.value)}
                  className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label
                    htmlFor="cita-inicio"
                    className="mb-1.5 block text-sm font-medium text-slate-700"
                  >
                    Hora de inicio
                  </label>
                  <input
                    id="cita-inicio"
                    type="time"
                    required
                    value={formCita.horaInicio}
                    onChange={(e) =>
                      actualizarFormCita('horaInicio', e.target.value)
                    }
                    className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
                  />
                </div>
                <div>
                  <label
                    htmlFor="cita-fin"
                    className="mb-1.5 block text-sm font-medium text-slate-700"
                  >
                    Hora de fin
                  </label>
                  <input
                    id="cita-fin"
                    type="time"
                    required
                    value={formCita.horaFin}
                    onChange={(e) => actualizarFormCita('horaFin', e.target.value)}
                    className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
                  />
                </div>
              </div>

              <div>
                <label
                  htmlFor="cita-tratamiento"
                  className="mb-1.5 block text-sm font-medium text-slate-700"
                >
                  Tratamiento
                </label>
                <select
                  id="cita-tratamiento"
                  required
                  value={formCita.tratamiento}
                  onChange={(e) =>
                    actualizarFormCita('tratamiento', e.target.value)
                  }
                  className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
                >
                  <option value="" disabled>
                    Seleccione un tratamiento…
                  </option>
                  {TRATAMIENTOS_ODONTOLOGICOS.map((opcion) => (
                    <option key={opcion} value={opcion}>
                      {opcion}
                    </option>
                  ))}
                </select>
              </div>

              <div className="flex flex-wrap justify-end gap-3 border-t border-slate-100 pt-4">
                <button
                  type="button"
                  onClick={cerrarModal}
                  disabled={guardandoCita}
                  className="rounded-lg border border-slate-200 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-60"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={guardandoCita}
                  className="inline-flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-70"
                >
                  {guardandoCita ? (
                    <>
                      <span
                        className="h-4 w-4 animate-spin rounded-full border-2 border-white/30 border-t-white"
                        aria-hidden="true"
                      />
                      Guardando...
                    </>
                  ) : modoEdicion ? (
                    'Guardar cambios'
                  ) : (
                    'Guardar cita'
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}

export default ModuloCitas
