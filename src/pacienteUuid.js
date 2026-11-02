export function esCodigoVisualPaciente(valor) {
  return typeof valor === 'string' && /^PAC-/i.test(valor.trim())
}

/** UUID real del paciente para llamadas al API (nunca PAC-00X). */
export function resolverUuidPaciente(paciente) {
  if (!paciente) return null

  const candidatos = [paciente.id_real_uuid, paciente.id]
  for (const candidato of candidatos) {
    if (candidato == null) continue
    const texto = String(candidato).trim()
    if (texto && !esCodigoVisualPaciente(texto)) {
      return texto
    }
  }

  return null
}
