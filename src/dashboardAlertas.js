import { Banknote, CheckCircle2, Clock } from 'lucide-react'
import { citasDelDia } from './citasCompartidas.js'
import { formatearMoneda } from './finanzasMetricas.js'

export function construirAlertasDashboard(citas = [], cobros = []) {
  const agendaHoy = citasDelDia(citas)
  const porAtender = agendaHoy.filter((c) => c.estado === 'Agendado').length
  const completadosHoy = agendaHoy.filter((c) => c.estado === 'Completado').length
  const cuentasConSaldo = cobros.filter(
    (c) => (Number(c.saldoPendiente) || 0) > 0,
  )
  const cuentasPendientes = cuentasConSaldo.length
  const totalSaldoPendiente = cuentasConSaldo.reduce(
    (acc, c) => acc + (Number(c.saldoPendiente) || 0),
    0,
  )

  const alertas = []

  if (porAtender > 0) {
    alertas.push({
      id: 'agenda-pendiente',
      texto:
        porAtender === 1
          ? 'Tienes 1 paciente por atender hoy'
          : `Tienes ${porAtender} pacientes por atender hoy`,
      icon: Clock,
      iconClass: 'bg-blue-100 text-blue-700',
    })
  } else {
    alertas.push({
      id: 'agenda-ok',
      texto: 'Agenda del día completada',
      icon: CheckCircle2,
      iconClass: 'bg-emerald-100 text-emerald-700',
    })
  }

  if (cuentasPendientes > 0) {
    alertas.push({
      id: 'finanzas-pendiente',
      texto:
        cuentasPendientes === 1
          ? `Existe 1 cuenta pendiente (${formatearMoneda(totalSaldoPendiente)} por cobrar)`
          : `Existen ${cuentasPendientes} cuentas pendientes (${formatearMoneda(totalSaldoPendiente)} por cobrar)`,
      icon: Banknote,
      iconClass: 'bg-amber-100 text-amber-800',
    })
  } else {
    alertas.push({
      id: 'finanzas-ok',
      texto: 'Sin cuentas con saldo pendiente por cobrar',
      icon: CheckCircle2,
      iconClass: 'bg-emerald-100 text-emerald-700',
    })
  }

  if (completadosHoy > 0) {
    alertas.push({
      id: 'productividad-ok',
      texto:
        completadosHoy === 1
          ? '1 tratamiento completado exitosamente hoy'
          : `${completadosHoy} tratamientos completados exitosamente hoy`,
      icon: CheckCircle2,
      iconClass: 'bg-emerald-100 text-emerald-700',
    })
  } else {
    alertas.push({
      id: 'productividad-vacio',
      texto: 'Ningún tratamiento completado hoy',
      icon: Clock,
      iconClass: 'bg-slate-100 text-slate-600',
    })
  }

  return alertas
}
