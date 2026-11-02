import { useCallback, useMemo, useState } from 'react'
import {
  BarChart3,
  CircleDollarSign,
  Plus,
  Receipt,
  Star,
  TrendingUp,
  Wallet,
} from 'lucide-react'
import toast from 'react-hot-toast'
import { TRATAMIENTOS_ODONTOLOGICOS, esTratamientoCatalogo } from './citasCompartidas.js'
import {
  agruparIngresosPorTratamiento,
  calcularIngresoPromedio,
  esMetodoPagoValido,
  fechaVisibleEnHistorial,
  formatearMoneda,
  METODOS_PAGO,
  obtenerFechaHoyISO,
  obtenerTratamientoEstrella,
  ordenarHistorialPagos,
  sumarIngresosDelMes,
  sumarSaldosPendientes,
  etiquetaEstadoHistorial,
} from './finanzasMetricas.js'
import { resolverUuidPaciente } from './pacienteUuid.js'
import { headersApiJson } from './apiAuthHeaders.js'

const API_FINANZAS_CUENTA_URL = 'https://emr-backend-7pt1.onrender.com/api/finanzas/cuenta'

const claseInputModal =
  'w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20'

function formularioAbonoVacio() {
  return {
    montoAbonar: '',
    metodoPago: '',
  }
}

function formularioCobroVacio() {
  return {
    pacienteId: '',
    tratamiento: '',
    costoTotal: '',
    montoPagado: '',
    metodoPago: '',
    fecha: obtenerFechaHoyISO(),
  }
}

function FinanzasProductividad({
  pacientes = [],
  cobros = [],
  onRecargarCobros,
}) {
  const [modalAbierto, setModalAbierto] = useState(false)
  const [formCobro, setFormCobro] = useState(() => formularioCobroVacio())
  const [guardando, setGuardando] = useState(false)
  const [modalAbonoAbierto, setModalAbonoAbierto] = useState(false)
  const [cuentaAbono, setCuentaAbono] = useState(null)
  const [nombrePacienteAbono, setNombrePacienteAbono] = useState('')
  const [formAbono, setFormAbono] = useState(() => formularioAbonoVacio())
  const [guardandoAbono, setGuardandoAbono] = useState(false)

  const mapaPacientes = useMemo(() => {
    const mapa = new Map()
    pacientes.forEach((p) => {
      const uuid = resolverUuidPaciente(p)
      if (uuid) mapa.set(uuid, p)
      mapa.set(p.id, p)
    })
    return mapa
  }, [pacientes])

  const ingresosMes = useMemo(() => sumarIngresosDelMes(cobros), [cobros])
  const totalPorCobrar = useMemo(() => sumarSaldosPendientes(cobros), [cobros])
  const ingresoPromedio = useMemo(
    () => calcularIngresoPromedio(cobros),
    [cobros],
  )
  const tratamientoEstrella = useMemo(
    () => obtenerTratamientoEstrella(cobros),
    [cobros],
  )

  const historialPagos = useMemo(
    () => ordenarHistorialPagos(cobros),
    [cobros],
  )

  const ingresosPorTratamiento = useMemo(
    () => agruparIngresosPorTratamiento(cobros),
    [cobros],
  )

  const maxIngresoTratamiento = useMemo(() => {
    if (ingresosPorTratamiento.length === 0) return 0
    return Math.max(...ingresosPorTratamiento.map((i) => i.ingreso), 0)
  }, [ingresosPorTratamiento])

  const kpis = useMemo(
    () => [
      {
        id: 'ingresos-mes',
        label: 'Ingresos del Mes',
        value: formatearMoneda(ingresosMes),
        icon: Wallet,
        iconClass: 'bg-emerald-100 text-emerald-700',
      },
      {
        id: 'cuentas-cobrar',
        label: 'Cuentas por Cobrar',
        value: `${formatearMoneda(totalPorCobrar)} pendientes`,
        icon: CircleDollarSign,
        iconClass: 'bg-amber-100 text-amber-700',
      },
      {
        id: 'ingreso-promedio',
        label: 'Ingreso Promedio',
        value: cobros.length
          ? formatearMoneda(ingresoPromedio)
          : formatearMoneda(0),
        icon: TrendingUp,
        iconClass: 'bg-blue-100 text-blue-700',
      },
      {
        id: 'tratamiento-estrella',
        label: 'Tratamiento Estrella',
        value: tratamientoEstrella ?? 'Sin registros',
        icon: Star,
        iconClass: 'bg-violet-100 text-violet-700',
      },
    ],
    [
      ingresosMes,
      totalPorCobrar,
      ingresoPromedio,
      tratamientoEstrella,
      cobros.length,
    ],
  )

  const abrirModal = () => {
    setFormCobro(formularioCobroVacio())
    setModalAbierto(true)
  }

  const cerrarModal = () => {
    if (guardando) return
    setModalAbierto(false)
    setFormCobro(formularioCobroVacio())
  }

  const actualizarCampo = (campo, valor) => {
    setFormCobro((prev) => ({ ...prev, [campo]: valor }))
  }

  const abrirModalAbono = (fila, nombrePaciente) => {
    setCuentaAbono(fila)
    setNombrePacienteAbono(nombrePaciente)
    setFormAbono(formularioAbonoVacio())
    setModalAbonoAbierto(true)
  }

  const cerrarModalAbono = () => {
    if (guardandoAbono) return
    setModalAbonoAbierto(false)
    setCuentaAbono(null)
    setNombrePacienteAbono('')
    setFormAbono(formularioAbonoVacio())
  }

  const actualizarCampoAbono = (campo, valor) => {
    setFormAbono((prev) => ({ ...prev, [campo]: valor }))
  }

  const guardarAbono = useCallback(
    async (e) => {
      e.preventDefault()

      if (!cuentaAbono?.id) {
        toast.error('No se encontró la cuenta a abonar')
        return
      }

      const saldoPendiente = Number(cuentaAbono.saldoPendiente) || 0
      const montoAbonar = Number(formAbono.montoAbonar)

      if (!Number.isFinite(montoAbonar) || montoAbonar <= 0) {
        toast.error('Ingrese un monto a abonar mayor que cero')
        return
      }
      if (montoAbonar > saldoPendiente) {
        toast.error('El abono no puede superar el saldo pendiente')
        return
      }
      if (!esMetodoPagoValido(formAbono.metodoPago)) {
        toast.error('Seleccione un método de pago')
        return
      }
      if (typeof onRecargarCobros !== 'function') {
        toast.error('No se pudo registrar el abono')
        return
      }

      setGuardandoAbono(true)
      try {
        const response = await fetch(
          `${API_FINANZAS_CUENTA_URL}/${encodeURIComponent(cuentaAbono.id)}/abono`,
          {
            method: 'POST',
            headers: headersApiJson(),
            body: JSON.stringify({
              monto_abonado: montoAbonar,
              metodo_pago: formAbono.metodoPago,
              fecha_cobro: obtenerFechaHoyISO(),
            }),
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
            (data && data.error) || 'No se pudo registrar el abono en el servidor',
          )
        }

        await onRecargarCobros()
        toast.success('Abono registrado correctamente')
        cerrarModalAbono()
      } catch (error) {
        toast.error(error?.message || 'No se pudo registrar el abono')
      } finally {
        setGuardandoAbono(false)
      }
    },
    [cuentaAbono, formAbono, onRecargarCobros],
  )

  const guardarCobro = useCallback(
    async (e) => {
      e.preventDefault()

      if (!formCobro.pacienteId) {
        toast.error('Seleccione un paciente')
        return
      }
      if (!esTratamientoCatalogo(formCobro.tratamiento)) {
        toast.error('Seleccione un tratamiento del catálogo')
        return
      }

      const costoTotal = Number(formCobro.costoTotal)
      const montoPagado = Number(formCobro.montoPagado)

      if (!Number.isFinite(costoTotal) || costoTotal <= 0) {
        toast.error('Ingrese un costo total válido')
        return
      }
      if (!Number.isFinite(montoPagado) || montoPagado < 0) {
        toast.error('Ingrese un monto pagado válido')
        return
      }
      if (montoPagado > costoTotal) {
        toast.error('El monto pagado no puede superar el costo total')
        return
      }
      if (!esMetodoPagoValido(formCobro.metodoPago)) {
        toast.error('Seleccione un método de pago')
        return
      }

      if (typeof onRecargarCobros !== 'function') {
        toast.error('No se pudo registrar el cobro')
        return
      }

      setGuardando(true)
      try {
        const response = await fetch(API_FINANZAS_CUENTA_URL, {
          method: 'POST',
          headers: headersApiJson(),
          body: JSON.stringify({
            paciente_id: formCobro.pacienteId,
            tratamiento: formCobro.tratamiento,
            costo_total: costoTotal,
            monto_pagado: montoPagado,
            metodo_pago: formCobro.metodoPago,
            fecha_cobro: formCobro.fecha || obtenerFechaHoyISO(),
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
            (data && data.error) || 'No se pudo registrar el cobro en el servidor',
          )
        }

        await onRecargarCobros()
        toast.success('Cobro registrado correctamente')
        cerrarModal()
      } catch (error) {
        toast.error(error?.message || 'No se pudo registrar el cobro')
      } finally {
        setGuardando(false)
      }
    },
    [formCobro, onRecargarCobros],
  )

  return (
    <div className="space-y-8">
      <div className="flex justify-end">
        <button
          type="button"
          onClick={abrirModal}
          className="rounded-lg bg-blue-600 px-5 py-2.5 text-sm font-semibold text-white shadow-md transition-colors hover:bg-blue-700"
        >
          + Registrar Cobro
        </button>
      </div>

      <section className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {kpis.map((kpi) => {
          const Icono = kpi.icon
          return (
            <article
              key={kpi.id}
              className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm"
            >
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                    {kpi.label}
                  </p>
                  <p className="mt-2 text-lg font-bold leading-snug text-slate-900 xl:text-xl">
                    {kpi.value}
                  </p>
                </div>
                <div
                  className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-lg ${kpi.iconClass}`}
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
          <div className="mb-4 flex items-center gap-2">
            <Receipt className="h-5 w-5 text-slate-700" aria-hidden="true" />
            <h3 className="text-lg font-semibold text-slate-900">
              Historial de Pagos
            </h3>
          </div>
          {historialPagos.length === 0 ? (
            <p className="text-sm text-slate-500">
              No hay registros de pagos aún.
            </p>
          ) : (
            <div className="overflow-x-auto">
            <table className="w-full min-w-[640px] border-collapse text-left text-sm">
              <thead>
                <tr className="border-b border-slate-200 text-xs uppercase tracking-wide text-slate-500">
                  <th className="min-w-[5.75rem] whitespace-nowrap pb-3 pr-3 font-semibold">
                    Fecha
                  </th>
                  <th className="min-w-[9rem] whitespace-nowrap pb-3 pr-3 font-semibold">
                    Paciente
                  </th>
                  <th className="min-w-[8rem] pb-3 pr-3 font-semibold">Tratamiento</th>
                  <th className="min-w-[4.5rem] whitespace-nowrap pb-3 pr-3 font-semibold">
                    Total
                  </th>
                  <th className="min-w-[4.5rem] whitespace-nowrap pb-3 pr-3 font-semibold">
                    Saldo
                  </th>
                  <th className="min-w-[7.5rem] whitespace-nowrap pb-3 text-right font-semibold">
                    Est.
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {historialPagos.map((fila) => {
                  const paciente =
                    fila.nombrePaciente ??
                    mapaPacientes.get(fila.pacienteId)?.nombre_completo ??
                    fila.pacienteId
                  const badge = etiquetaEstadoHistorial(fila)
                  return (
                    <tr key={fila.id} className="text-slate-700">
                      <td className="min-w-[5.75rem] whitespace-nowrap py-3 pr-3 tabular-nums text-slate-600">
                        {fechaVisibleEnHistorial(fila)}
                      </td>
                      <td
                        className="min-w-[9rem] whitespace-nowrap py-3 pr-3 font-medium text-slate-900"
                        title={paciente}
                      >
                        {paciente}
                      </td>
                      <td
                        className="max-w-[12rem] truncate py-3 pr-3"
                        title={fila.tratamiento}
                      >
                        {fila.tratamiento}
                      </td>
                      <td className="min-w-[4.5rem] whitespace-nowrap py-3 pr-3 tabular-nums">
                        {formatearMoneda(fila.costoTotal)}
                      </td>
                      <td
                        className={`min-w-[4.5rem] whitespace-nowrap py-3 pr-3 font-semibold tabular-nums ${
                          fila.saldoPendiente > 0
                            ? 'text-amber-800'
                            : 'text-slate-600'
                        }`}
                      >
                        {formatearMoneda(fila.saldoPendiente)}
                      </td>
                      <td className="min-w-[7.5rem] whitespace-nowrap py-3 text-right">
                        <div className="inline-flex items-center justify-end gap-1.5">
                          {badge.texto === 'Pendiente' && (
                            <button
                              type="button"
                              title="Abonar"
                              onClick={() => abrirModalAbono(fila, paciente)}
                              className="inline-flex h-7 w-7 items-center justify-center rounded-lg border border-blue-200 bg-blue-50 text-blue-800 transition-colors hover:bg-blue-100"
                            >
                              <Plus className="h-3.5 w-3.5" aria-hidden="true" />
                              <span className="sr-only">Abonar</span>
                            </button>
                          )}
                          <span
                            className={`inline-flex whitespace-nowrap rounded-full px-2 py-0.5 text-[11px] font-medium leading-tight ring-1 ring-inset ${badge.className}`}
                          >
                            {badge.texto}
                          </span>
                        </div>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
            </div>
          )}
        </article>

        <article className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
          <div className="mb-1 flex items-center gap-2">
            <BarChart3 className="h-5 w-5 text-violet-700" aria-hidden="true" />
            <h3 className="text-lg font-semibold text-slate-900">
              Ingresos por Tratamiento
            </h3>
          </div>
          <p className="text-sm text-slate-500">
            Monto total cobrado agrupado por tipo de tratamiento
          </p>
          {ingresosPorTratamiento.length === 0 ? (
            <p className="mt-6 text-sm text-slate-500">
              Registre cobros para visualizar ingresos por tratamiento.
            </p>
          ) : (
            <ul className="mt-6 space-y-4">
              {ingresosPorTratamiento.map((item) => {
                const ancho =
                  maxIngresoTratamiento > 0
                    ? (item.ingreso / maxIngresoTratamiento) * 100
                    : 0
                return (
                  <li key={item.tratamiento}>
                    <div className="mb-1.5 flex items-center justify-between gap-2 text-sm">
                      <span className="min-w-0 truncate font-medium text-slate-800">
                        {item.tratamiento}
                      </span>
                      <span className="shrink-0 tabular-nums text-slate-600">
                        {formatearMoneda(item.ingreso)}
                      </span>
                    </div>
                    <div className="h-2.5 overflow-hidden rounded-full bg-slate-100">
                      <div
                        className="h-full rounded-full bg-violet-600 transition-all"
                        style={{ width: `${ancho}%` }}
                      />
                    </div>
                  </li>
                )
              })}
            </ul>
          )}
        </article>
      </section>

      {modalAbonoAbierto && cuentaAbono && (
        <div
          className="fixed inset-0 z-[60] flex items-center justify-center bg-slate-900/50 p-4"
          role="dialog"
          aria-modal="true"
          aria-labelledby="modal-abono-titulo"
        >
          <div className="w-full max-w-md rounded-2xl border border-slate-200 bg-white shadow-2xl">
            <div className="border-b border-slate-100 px-6 py-4">
              <h4
                id="modal-abono-titulo"
                className="text-lg font-bold text-slate-900"
              >
                Registrar Abono
              </h4>
              <p className="mt-1 text-sm text-slate-500">
                Pago parcial sobre la cuenta pendiente del paciente.
              </p>
            </div>

            <form onSubmit={guardarAbono} className="space-y-4 px-6 py-5">
              <div>
                <span className="mb-1.5 block text-sm font-medium text-slate-700">
                  Paciente
                </span>
                <p className="rounded-lg border border-slate-100 bg-slate-50 px-3 py-2 text-sm font-medium text-slate-900">
                  {nombrePacienteAbono}
                </p>
              </div>

              <div>
                <span className="mb-1.5 block text-sm font-medium text-slate-700">
                  Saldo pendiente
                </span>
                <p className="rounded-lg border border-amber-100 bg-amber-50 px-3 py-2 text-sm font-semibold tabular-nums text-amber-900">
                  {formatearMoneda(cuentaAbono.saldoPendiente)}
                </p>
              </div>

              <div>
                <label
                  htmlFor="abono-monto"
                  className="mb-1.5 block text-sm font-medium text-slate-700"
                >
                  Monto a abonar (USD)
                </label>
                <input
                  id="abono-monto"
                  type="number"
                  min="0.01"
                  step="0.01"
                  max={cuentaAbono.saldoPendiente}
                  required
                  value={formAbono.montoAbonar}
                  onChange={(e) =>
                    actualizarCampoAbono('montoAbonar', e.target.value)
                  }
                  className={`${claseInputModal} tabular-nums`}
                />
              </div>

              <div>
                <label
                  htmlFor="abono-metodo-pago"
                  className="mb-1.5 block text-sm font-medium text-slate-700"
                >
                  Método de pago
                </label>
                <select
                  id="abono-metodo-pago"
                  required
                  value={formAbono.metodoPago}
                  onChange={(e) =>
                    actualizarCampoAbono('metodoPago', e.target.value)
                  }
                  className={claseInputModal}
                >
                  <option value="" disabled>
                    Seleccione un método…
                  </option>
                  {METODOS_PAGO.map((metodo) => (
                    <option key={metodo} value={metodo}>
                      {metodo}
                    </option>
                  ))}
                </select>
              </div>

              <div className="flex flex-wrap justify-end gap-3 border-t border-slate-100 pt-4">
                <button
                  type="button"
                  onClick={cerrarModalAbono}
                  disabled={guardandoAbono}
                  className="rounded-lg border border-slate-200 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-60"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={guardandoAbono}
                  className="inline-flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-70"
                >
                  {guardandoAbono ? 'Guardando…' : 'Guardar Abono'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {modalAbierto && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4"
          role="dialog"
          aria-modal="true"
          aria-labelledby="modal-cobro-titulo"
        >
          <div className="max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-2xl border border-slate-200 bg-white shadow-2xl">
            <div className="border-b border-slate-100 px-6 py-4">
              <h4
                id="modal-cobro-titulo"
                className="text-lg font-bold text-slate-900"
              >
                Registrar cobro
              </h4>
              <p className="mt-1 text-sm text-slate-500">
                El saldo y el estado se calculan automáticamente al guardar.
              </p>
            </div>

            <form onSubmit={guardarCobro} className="space-y-4 px-6 py-5">
              <div>
                <label
                  htmlFor="cobro-fecha"
                  className="mb-1.5 block text-sm font-medium text-slate-700"
                >
                  Fecha del cobro
                </label>
                <input
                  id="cobro-fecha"
                  type="date"
                  required
                  value={formCobro.fecha}
                  onChange={(e) => actualizarCampo('fecha', e.target.value)}
                  className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
                />
              </div>

              <div>
                <label
                  htmlFor="cobro-paciente"
                  className="mb-1.5 block text-sm font-medium text-slate-700"
                >
                  Paciente
                </label>
                <select
                  id="cobro-paciente"
                  required
                  value={formCobro.pacienteId}
                  onChange={(e) => actualizarCampo('pacienteId', e.target.value)}
                  className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
                >
                  <option value="" disabled>
                    Seleccione un paciente…
                  </option>
                  {pacientes.map((paciente) => {
                    const uuid = resolverUuidPaciente(paciente)
                    if (!uuid) return null
                    return (
                      <option key={uuid} value={uuid}>
                        {paciente.nombre_completo} (
                        {paciente.codigo_visual ?? uuid})
                      </option>
                    )
                  })}
                </select>
              </div>

              <div>
                <label
                  htmlFor="cobro-metodo-pago"
                  className="mb-1.5 block text-sm font-medium text-slate-700"
                >
                  Método de Pago
                </label>
                <select
                  id="cobro-metodo-pago"
                  required
                  value={formCobro.metodoPago}
                  onChange={(e) => actualizarCampo('metodoPago', e.target.value)}
                  className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
                >
                  <option value="" disabled>
                    Seleccione un método…
                  </option>
                  {METODOS_PAGO.map((metodo) => (
                    <option key={metodo} value={metodo}>
                      {metodo}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label
                  htmlFor="cobro-tratamiento"
                  className="mb-1.5 block text-sm font-medium text-slate-700"
                >
                  Tratamiento
                </label>
                <select
                  id="cobro-tratamiento"
                  required
                  value={formCobro.tratamiento}
                  onChange={(e) => actualizarCampo('tratamiento', e.target.value)}
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

              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div>
                  <label
                    htmlFor="cobro-costo"
                    className="mb-1.5 block text-sm font-medium text-slate-700"
                  >
                    Costo total (USD)
                  </label>
                  <input
                    id="cobro-costo"
                    type="number"
                    min="0.01"
                    step="0.01"
                    required
                    value={formCobro.costoTotal}
                    onChange={(e) => actualizarCampo('costoTotal', e.target.value)}
                    className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm tabular-nums focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
                  />
                </div>
                <div>
                  <label
                    htmlFor="cobro-pagado"
                    className="mb-1.5 block text-sm font-medium text-slate-700"
                  >
                    Monto pagado (USD)
                  </label>
                  <input
                    id="cobro-pagado"
                    type="number"
                    min="0"
                    step="0.01"
                    required
                    value={formCobro.montoPagado}
                    onChange={(e) => actualizarCampo('montoPagado', e.target.value)}
                    className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm tabular-nums focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
                  />
                </div>
              </div>

              <div className="flex flex-wrap justify-end gap-3 border-t border-slate-100 pt-4">
                <button
                  type="button"
                  onClick={cerrarModal}
                  disabled={guardando}
                  className="rounded-lg border border-slate-200 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-60"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={guardando}
                  className="inline-flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-70"
                >
                  {guardando ? 'Guardando…' : 'Guardar cobro'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}

export default FinanzasProductividad
