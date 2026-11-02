function escaparHtml(texto) {
  return String(texto ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

function formatearFechaConsultaImpresion(fecha) {
  if (!fecha) return '—'
  const fechaObj = new Date(fecha)
  if (Number.isNaN(fechaObj.getTime())) return String(fecha)
  return fechaObj.toLocaleDateString('es-ES', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  })
}

export function imprimirResumenConsulta(consulta, paciente) {
  const html = `<!DOCTYPE html>
<html lang="es">
  <head>
    <meta charset="UTF-8" />
    <title>Consulta — ${escaparHtml(paciente?.nombre_completo ?? 'Paciente')}</title>
    <style>
      body { font-family: Arial, sans-serif; color: #1e293b; margin: 32px; line-height: 1.5; }
      h1 { font-size: 20px; margin-bottom: 4px; color: #1e3a8a; }
      .meta { color: #64748b; font-size: 13px; margin-bottom: 24px; }
      section { margin-bottom: 20px; }
      h2 { font-size: 14px; text-transform: uppercase; letter-spacing: 0.04em; color: #334155; border-bottom: 1px solid #e2e8f0; padding-bottom: 6px; }
      p { margin: 8px 0 0; white-space: pre-wrap; }
      @media print { body { margin: 16px; } }
    </style>
  </head>
  <body>
    <h1>Resumen de Consulta Clínica</h1>
    <p class="meta">EMR Médico — Documento generado para impresión / PDF</p>

    <section>
      <h2>Datos del paciente</h2>
      <p><strong>Nombre:</strong> ${escaparHtml(paciente?.nombre_completo)}</p>
      <p><strong>Cédula:</strong> ${escaparHtml(paciente?.documento_identidad ?? '—')}</p>
      <p><strong>Historia:</strong> ${escaparHtml(paciente?.codigo_visual ?? '—')}</p>
    </section>

    <section>
      <h2>Consulta</h2>
      <p><strong>Fecha:</strong> ${escaparHtml(formatearFechaConsultaImpresion(consulta?.fecha_consulta))}</p>
      <p><strong>Motivo:</strong> ${escaparHtml(consulta?.motivo_consulta ?? '—')}</p>
      <p><strong>Notas médicas:</strong><br />${escaparHtml(consulta?.notas_medicas ?? '—')}</p>
    </section>
  </body>
</html>`

  const ventana = window.open('', '_blank', 'noopener,noreferrer')
  if (!ventana) {
    window.alert('Permita ventanas emergentes para imprimir o guardar como PDF.')
    return
  }

  ventana.document.open()
  ventana.document.write(html)
  ventana.document.close()
  ventana.focus()
  ventana.onload = () => {
    ventana.print()
  }
}
