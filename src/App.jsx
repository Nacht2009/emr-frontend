import { useCallback, useEffect, useRef, useState } from 'react'
import SignatureCanvas from 'react-signature-canvas'
import jsPDF from 'jspdf'
import html2canvas from 'html2canvas'
import toast, { Toaster } from 'react-hot-toast'
import {
  BarChart3,
  CalendarDays,
  LayoutDashboard,
  Users,
  Wallet,
} from 'lucide-react'
import DashboardFinanciero from './DashboardFinanciero.jsx'
import FinanzasProductividad from './FinanzasProductividad.jsx'
import Login from './Login.jsx'
import ModuloCitas from './ModuloCitas.jsx'
import PerfilPaciente from './PerfilPaciente.jsx'
import ReportesEstadisticas from './ReportesEstadisticas.jsx'
import { citaDesdeApi } from './citasCompartidas.js'
import { cobroDesdeApi } from './finanzasMetricas.js'
import {
  fechaPostgresAInputDate,
  formatearFechaPostgres,
} from './fechas.js'
import {
  esCodigoVisualPaciente,
  resolverUuidPaciente,
} from './pacienteUuid.js'
import { headersApiAuth, headersApiJson } from './apiAuthHeaders.js'

const CUADRANTE_1 = [18, 17, 16, 15, 14, 13, 12, 11] // Superior Derecho
const CUADRANTE_2 = [21, 22, 23, 24, 25, 26, 27, 28] // Superior Izquierdo
const CUADRANTE_4 = [48, 47, 46, 45, 44, 43, 42, 41] // Inferior Derecho
const CUADRANTE_3 = [31, 32, 33, 34, 35, 36, 37, 38] // Inferior Izquierdo
const ESTADOS_DIENTE = ['sano', 'caries', 'tratado', 'protesis', 'ausente']

const clasesEstadoDiente = {
  sano: 'bg-white text-gray-800 border-gray-200',
  caries: 'bg-red-100 text-red-700 border-red-300',
  tratado: 'bg-blue-100 text-blue-700 border-blue-300',
  protesis: 'bg-green-100 text-green-700 border-green-300',
  ausente: 'bg-gray-200 text-gray-500 border-gray-600 line-through',
}

const PRUEBAS_DIAGNOSTICO_ENDODONCIA = [
  'Percusión Vertical',
  'Percusión Horizontal',
  'Palpación Apical',
  'Prueba Térmica Frío',
  'Prueba Térmica Calor',
]

const DIAGNOSTICO_PULPAR_AAE = [
  'Pulpa Sana',
  'Pulpitis Reversible',
  'Pulpitis Irreversible Sintomática',
  'Pulpitis Irreversible Asintomática',
  'Necrosis Pulpar',
  'Tratamiento Previamente Iniciado / Tratado',
]

const DIAGNOSTICO_PERIAPICAL_AAE = [
  'Tejidos Periapicales Normales',
  'Periodontitis Apical Aguda Sintomática',
  'Periodontitis Apical Asintomática',
  'Absceso Apical Agudo',
  'Absceso Apical Crónico (Fístula)',
  'Osteítis Condensante',
]

const CONDUCTOS_FICHA_TECNICA = [
  'Pre/Max / Único',
  'Mesial / MV',
  'Distal / DV',
  'Palatino / ML',
]

const COLUMNAS_CONDUCTOMETRIA = [
  'Referencia Anatómica',
  'Longitud Aparente (LAC) mm',
  'Longitud de Trabajo (LT) mm',
  'Instrumento Inicial (MAF)',
  'Instrumento Final (FLARE)',
]

const inputClinico =
  'w-full rounded-lg border border-gray-200 bg-gray-50 px-3 py-2 text-sm text-gray-800 placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500'

const inputSoloLectura =
  'w-full cursor-not-allowed rounded-lg border border-gray-200 bg-gray-100 px-3 py-2 text-sm text-gray-600 focus:outline-none'

const FORMULARIO_CONSULTA_VACIO = {
  nombreCompleto: '',
  documentoIdentidad: '',
  edad: '',
  sexo: '',
  telefono: '',
  motivoConsulta: '',
  pesoConsulta: '',
  alturaConsulta: '',
  presionArterial: '',
  historiaEnfermedadActual: '',
  habitosFisiologicos: '',
  tratamientoMedicoActual: '',
  hallazgosGenerales: '',
}

const PLANTILLAS_CLINICAS_ODONTO = [
  'Anestesia local infiltrativa',
  'Aislamiento absoluto con dique de goma',
  'Instrumentación rotatoria y conductometría',
  'Paciente refiere dolor a la percusión',
  'Se indica radiografía periapical',
  'Irrigación con NaOCl al 2.5%',
  'Obturación con técnica de condensación lateral',
  'Control de oclusión postoperatorio',
]

function insertarPlantillaEnCampo(textoActual, plantilla) {
  const base = textoActual.trimEnd()
  if (!base) return plantilla
  return `${base}\n${plantilla}`
}

function normalizarMedidaPerfil(valor) {
  if (valor == null || valor === '' || valor === '—') return ''
  return String(valor)
}

function crearFormularioDesdePaciente(paciente) {
  if (!paciente) {
    return { ...FORMULARIO_CONSULTA_VACIO }
  }

  return {
    ...FORMULARIO_CONSULTA_VACIO,
    nombreCompleto: paciente.nombre_completo ?? '',
    documentoIdentidad: paciente.documento_identidad ?? '',
    edad: paciente.edad != null ? String(paciente.edad) : '',
    sexo: paciente.sexo ?? '',
    telefono: paciente.telefono ?? '',
    pesoConsulta: normalizarMedidaPerfil(paciente.peso),
    alturaConsulta: normalizarMedidaPerfil(paciente.altura),
  }
}

const API_PACIENTES_URL = 'https://emr-backend-7pt1.onrender.com/api/pacientes'
const API_CONSULTAS_URL = 'https://emr-backend-7pt1.onrender.com/api/consultas'
const API_EVOLUCIONES_URL = 'https://emr-backend-7pt1.onrender.com/api/evoluciones'
const API_CITAS_URL = 'https://emr-backend-7pt1.onrender.com/api/citas'
const API_FINANZAS_URL = 'https://emr-backend-7pt1.onrender.com/api/finanzas'

function crearEvolucionCitaVacia() {
  return {
    fecha: new Date().toISOString().slice(0, 10),
    evolucionProcedimiento: '',
    firmaProfesional: '',
  }
}

function construirPayloadPacienteApi(datos) {
  const edadNumerica =
    datos.edad.trim() === '' ? null : Number.parseInt(datos.edad, 10)

  return {
    nombre_completo: datos.nombreCompleto.trim(),
    documento_identidad: datos.documentoIdentidad.trim(),
    edad: Number.isFinite(edadNumerica) ? edadNumerica : null,
    sexo: datos.sexo.trim(),
    telefono: datos.telefono.trim(),
    peso: datos.pesoConsulta.trim(),
    altura: datos.alturaConsulta.trim(),
    presion_arterial: datos.presionArterial.trim(),
    motivo_consulta: datos.motivoConsulta.trim(),
    enfermedad_actual: datos.historiaEnfermedadActual.trim(),
  }
}

function formatearNumeroHistoria(numero) {
  if (numero == null || numero === '') return ''
  return `PAC-${String(numero).padStart(3, '0')}`
}

function pacienteApiAFilaTabla(pacienteApi, indiceFallback) {
  const numeroHistoria =
    pacienteApi.numero_historia != null
      ? pacienteApi.numero_historia
      : indiceFallback

  return {
    id: pacienteApi.id,
    id_real_uuid: pacienteApi.id,
    codigo_visual: formatearNumeroHistoria(numeroHistoria),
    numero_historia: numeroHistoria,
    nombre_completo: pacienteApi.nombre_completo ?? '',
    documento_identidad: pacienteApi.documento_identidad ?? '',
    edad: pacienteApi.edad ?? null,
    sexo: pacienteApi.sexo ?? '',
    telefono: pacienteApi.telefono ?? '',
    peso: pacienteApi.peso ?? '—',
    altura: pacienteApi.altura ?? '—',
    presion_arterial: pacienteApi.presion_arterial ?? '',
    motivo_consulta: pacienteApi.motivo_consulta ?? '',
    enfermedad_actual: pacienteApi.enfermedad_actual ?? '',
    ultima_consulta: new Date().toISOString().slice(0, 10),
    estado: pacienteApi.estado ?? 'Sano',
    fecha_registro: pacienteApi.created_at ?? pacienteApi.fecha_registro ?? null,
  }
}

function construirNotasMedicasConsulta(datos) {
  const partes = []

  if (datos.historiaEnfermedadActual?.trim()) {
    partes.push(`Enfermedad actual: ${datos.historiaEnfermedadActual.trim()}`)
  }
  if (datos.presionArterial?.trim()) {
    partes.push(`Presión arterial: ${datos.presionArterial.trim()}`)
  }
  if (datos.habitosFisiologicos?.trim()) {
    partes.push(`Hábitos fisiológicos: ${datos.habitosFisiologicos.trim()}`)
  }
  if (datos.tratamientoMedicoActual?.trim()) {
    partes.push(`Tratamiento médico: ${datos.tratamientoMedicoActual.trim()}`)
  }
  if (datos.pesoConsulta?.trim()) {
    partes.push(`Peso: ${datos.pesoConsulta.trim()}`)
  }
  if (datos.alturaConsulta?.trim()) {
    partes.push(`Altura: ${datos.alturaConsulta.trim()}`)
  }
  if (datos.hallazgosGenerales?.trim()) {
    partes.push(`Hallazgos generales: ${datos.hallazgosGenerales.trim()}`)
  }

  return partes.join('\n\n')
}

function parseNotasMedicasConsulta(notas) {
  const campos = {
    historiaEnfermedadActual: '',
    presionArterial: '',
    habitosFisiologicos: '',
    tratamientoMedicoActual: '',
    hallazgosGenerales: '',
    pesoConsulta: '',
    alturaConsulta: '',
  }

  if (!notas || typeof notas !== 'string') return campos

  const mapaEtiquetas = {
    'Enfermedad actual': 'historiaEnfermedadActual',
    'Presión arterial': 'presionArterial',
    'Hábitos fisiológicos': 'habitosFisiologicos',
    'Tratamiento médico': 'tratamientoMedicoActual',
    'Hallazgos generales': 'hallazgosGenerales',
    Peso: 'pesoConsulta',
    Altura: 'alturaConsulta',
  }

  notas.split('\n\n').forEach((bloque) => {
    const separador = bloque.indexOf(':')
    if (separador === -1) return
    const etiqueta = bloque.slice(0, separador).trim()
    const valor = bloque.slice(separador + 1).trim()
    const campo = mapaEtiquetas[etiqueta]
    if (campo) campos[campo] = valor
  })

  return campos
}

function construirPayloadActualizarPaciente(pacienteBase, datosFormulario) {
  const edadNumerica =
    datosFormulario.edad.trim() === ''
      ? pacienteBase.edad
      : Number.parseInt(datosFormulario.edad, 10)

  return {
    nombre_completo: pacienteBase.nombre_completo,
    documento_identidad: pacienteBase.documento_identidad ?? '',
    edad: Number.isFinite(edadNumerica) ? edadNumerica : pacienteBase.edad,
    sexo: pacienteBase.sexo ?? datosFormulario.sexo.trim(),
    telefono: pacienteBase.telefono ?? datosFormulario.telefono.trim(),
    peso: datosFormulario.pesoConsulta.trim(),
    altura: datosFormulario.alturaConsulta.trim(),
    presion_arterial: datosFormulario.presionArterial.trim(),
    motivo_consulta: datosFormulario.motivoConsulta.trim(),
    enfermedad_actual: datosFormulario.historiaEnfermedadActual.trim(),
  }
}

const selectClinico =
  'w-full rounded-lg border border-gray-200 bg-gray-50 px-3 py-2 text-sm text-gray-800 focus:outline-none focus:ring-2 focus:ring-blue-500'

const inputTabla =
  'w-full min-w-0 border-0 bg-transparent px-2 py-1.5 text-sm text-gray-700 placeholder:text-gray-400 focus:outline-none focus:ring-0'

const navItems = [
  { label: 'Dashboard', seccion: 'dashboard', icon: LayoutDashboard },
  { label: 'Pacientes', seccion: 'pacientes', icon: Users },
  { label: 'Citas', seccion: 'citas', icon: CalendarDays },
  { label: 'Reportes', seccion: 'reportes', icon: BarChart3 },
  { label: 'Finanzas', seccion: 'finanzas', icon: Wallet },
]

const estadoBadgeStyles = {
  Sano: 'bg-emerald-50 text-emerald-700 ring-emerald-600/20',
  'En Tratamiento': 'bg-amber-50 text-amber-700 ring-amber-600/20',
}

const TOAST_OPTIONS = {
  position: 'top-right',
  toastOptions: {
    duration: 3500,
    style: {
      background: '#1e293b',
      color: '#f8fafc',
      fontSize: '0.875rem',
    },
    success: {
      iconTheme: { primary: '#34d399', secondary: '#1e293b' },
    },
  },
}

const ESTADOS_PACIENTE_OPCIONES = ['Sano', 'En Tratamiento']

const DATOS_NUEVO_PACIENTE_INICIAL = {
  nombre_completo: '',
  documento_identidad: '',
  edad: '',
  sexo: '',
  telefono: '',
  peso: '',
  altura: '',
  presion_arterial: '',
  motivo_consulta: '',
  enfermedad_actual: '',
}

const SEXO_PACIENTE_OPCIONES = ['Masculino', 'Femenino', 'Otro']

function App() {
  const [isAuthenticated, setIsAuthenticated] = useState(
    () => !!localStorage.getItem('emr_token'),
  )
  const [guardandoHistoria, setGuardandoHistoria] = useState(false)
  const [seccionActual, setSeccionActual] = useState('dashboard')
  const [vistaPacientes, setVistaPacientes] = useState('tabla')
  const [pasoFormulario, setPasoFormulario] = useState(1)
  const [estadoDientes, setEstadoDientes] = useState({})
  const [pacientesRegistro, setPacientesRegistro] = useState([])
  const [busquedaPacientes, setBusquedaPacientes] = useState('')
  const [isEditModalOpen, setIsEditModalOpen] = useState(false)
  const [pacienteAEditar, setPacienteAEditar] = useState(null)
  const [guardandoEdicionPaciente, setGuardandoEdicionPaciente] = useState(false)
  const [modalEliminarVisible, setModalEliminarVisible] = useState(false)
  const [pacienteAEliminarId, setPacienteAEliminarId] = useState(null)
  const [eliminandoPaciente, setEliminandoPaciente] = useState(false)
  const [modalNuevoPacienteVisible, setModalNuevoPacienteVisible] =
    useState(false)
  const [datosNuevoPaciente, setDatosNuevoPaciente] = useState({
    nombre_completo: '',
    documento_identidad: '',
    edad: '',
    sexo: '',
    telefono: '',
    peso: '',
    altura: '',
    presion_arterial: '',
    motivo_consulta: '',
    enfermedad_actual: '',
  })
  const [guardandoNuevoPaciente, setGuardandoNuevoPaciente] = useState(false)
  const [modalExitoVisible, setModalExitoVisible] = useState(false)
  const [mensajeExito, setMensajeExito] = useState('')
  const [abrirModalCitasDesdeDashboard, setAbrirModalCitasDesdeDashboard] =
    useState(false)
  const [citas, setCitas] = useState([])
  const [cobros, setCobros] = useState([])
  const [pacientePerfilId, setPacientePerfilId] = useState(null)
  const [origenFormulario, setOrigenFormulario] = useState('tabla')
  const [modalidadHistoriaClinica, setModalidadHistoriaClinica] =
    useState('nuevo_paciente')
  const [tokenRecargaHistorialPerfil, setTokenRecargaHistorialPerfil] =
    useState(0)
  const [evolucionesPrevias, setEvolucionesPrevias] = useState([])
  const [evolucionCitaActual, setEvolucionCitaActual] = useState(() =>
    crearEvolucionCitaVacia(),
  )
  const [consultaEdicionId, setConsultaEdicionId] = useState(null)
  const [evolucionEdicionId, setEvolucionEdicionId] = useState(null)
  const [datosFormularioConsulta, setDatosFormularioConsulta] = useState(
    () => ({ ...FORMULARIO_CONSULTA_VACIO }),
  )
  const firmaOdontologoRef = useRef(null)
  const firmaPacienteRef = useRef(null)

  useEffect(() => {
    let cancelado = false

    async function cargarPacientes() {

      const token = localStorage.getItem('emr_token');
if (!token) return;

      try {
        const response = await fetch(API_PACIENTES_URL, {
          headers: headersApiAuth(),
        })
        if (!response.ok) {
          throw new Error('No se pudo cargar la lista de pacientes')
        }

        const data = await response.json()
        const filas = Array.isArray(data) ? data : []
        if (!cancelado) {
          setPacientesRegistro(
            filas.map((paciente, indice) =>
              pacienteApiAFilaTabla(paciente, indice + 1),
            ),
          )
        }
      } catch {
        if (!cancelado) {
          toast.error('No se pudo cargar la lista de pacientes')
        }
      }
    }

    cargarPacientes()

    return () => {
      cancelado = true
    }
  }, [])

  useEffect(() => {
    let cancelado = false

    async function cargarCitas() {

      const token = localStorage.getItem('emr_token');
if (!token) return;

      try {
        const response = await fetch(API_CITAS_URL, {
          headers: headersApiAuth(),
        })
        if (!response.ok) {
          throw new Error('No se pudo cargar la agenda de citas')
        }
        const data = await response.json()
        const filas = Array.isArray(data) ? data : []
        if (!cancelado) {
          setCitas(filas.map((fila) => citaDesdeApi(fila)))
        }
      } catch {
        if (!cancelado) {
          toast.error('No se pudo cargar la agenda de citas')
        }
      }
    }

    cargarCitas()

    return () => {
      cancelado = true
    }
  }, [])

  const recargarCobros = useCallback(async () => {

    const token = localStorage.getItem('emr_token');
  if (!token) return;

    try {
      const response = await fetch(API_FINANZAS_URL, {
        headers: headersApiAuth(),
      })
      if (!response.ok) {
        throw new Error('No se pudo cargar finanzas')
      }
      const data = await response.json()
      const filas = Array.isArray(data) ? data : []
      setCobros(filas.map((fila) => cobroDesdeApi(fila)))
    } catch {
      toast.error('No se pudo cargar el módulo de finanzas')
    }
  }, [])

  useEffect(() => {
    recargarCobros()
  }, [recargarCobros])

  const generarPDF = async () => {
    const element = document.getElementById('formulario-pdf')
    if (!element) return

    const pasos = element.querySelectorAll('[data-formulario-paso]')
    pasos.forEach((paso) => paso.classList.remove('hidden'))

    try {
      const canvas = await html2canvas(element, {
        scale: 2,
        useCORS: true,
        logging: false,
      })
      const imgData = canvas.toDataURL('image/png')
      const pdf = new jsPDF('p', 'mm', 'a4')
      const pageWidth = pdf.internal.pageSize.getWidth()
      const pageHeight = pdf.internal.pageSize.getHeight()
      const margin = 10
      const imgWidth = pageWidth - margin * 2
      const imgHeight = (canvas.height * imgWidth) / canvas.width

      let heightLeft = imgHeight
      let position = margin

      pdf.addImage(imgData, 'PNG', margin, position, imgWidth, imgHeight)
      heightLeft -= pageHeight - margin * 2

      while (heightLeft > 0) {
        pdf.addPage()
        position = heightLeft - imgHeight + margin
        pdf.addImage(imgData, 'PNG', margin, position, imgWidth, imgHeight)
        heightLeft -= pageHeight - margin * 2
      }

      pdf.save('Historia_Clinica.pdf')
    } finally {
      pasos.forEach((paso) => {
        const n = Number(paso.getAttribute('data-formulario-paso'))
        if (n !== pasoFormulario) paso.classList.add('hidden')
      })
    }
  }

  const cambiarEstadoDiente = (numero) => {
    setEstadoDientes((prev) => {
      const estadoActual = prev[numero] || 'sano'
      const idx = ESTADOS_DIENTE.indexOf(estadoActual)
      const nuevoEstado = ESTADOS_DIENTE[(idx + 1) % ESTADOS_DIENTE.length]
      return { ...prev, [numero]: nuevoEstado }
    })
  }

  const terminoBusquedaPacientes = busquedaPacientes.trim().toLowerCase()
  const pacientesFiltrados = pacientesRegistro.filter((paciente) => {
    if (!terminoBusquedaPacientes) return true

    const historiaVisible = String(
      paciente.codigo_visual ??
        formatearNumeroHistoria(paciente.numero_historia),
    ).toLowerCase()
    const historiaConCeros = String(paciente.numero_historia ?? '').padStart(3, '0')
    const documento = String(paciente.documento_identidad ?? '').toLowerCase()
    const nombre = String(paciente.nombre_completo ?? '').toLowerCase()

    return (
      nombre.includes(terminoBusquedaPacientes) ||
      historiaVisible.includes(terminoBusquedaPacientes) ||
      historiaConCeros.includes(terminoBusquedaPacientes) ||
      documento.includes(terminoBusquedaPacientes)
    )
  })

  const pacientePerfilSeleccionado =
    pacientePerfilId != null
      ? pacientesRegistro.find(
          (p) =>
            p.id === pacientePerfilId ||
            resolverUuidPaciente(p) === pacientePerfilId,
        )
      : null

  const volverAListaPacientes = () => {
    setVistaPacientes('tabla')
    setPacientePerfilId(null)
  }

  const abrirPerfilPaciente = (id) => {
    setPacientePerfilId(id)
    setVistaPacientes('perfil')
  }

  const abrirModalEditarPaciente = (paciente) => {
    setPacienteAEditar({ ...paciente })
    setIsEditModalOpen(true)
  }

  const cerrarModalNuevoPaciente = () => {
    if (guardandoNuevoPaciente) return
    setModalNuevoPacienteVisible(false)
    setDatosNuevoPaciente({ ...DATOS_NUEVO_PACIENTE_INICIAL })
  }

  const actualizarCampoNuevoPaciente = (campo, valor) => {
    setDatosNuevoPaciente((prev) => ({ ...prev, [campo]: valor }))
  }

  const crearPaciente = async (e) => {
    e.preventDefault()

    setGuardandoNuevoPaciente(true)
    try {
      const edadNumerica =
        datosNuevoPaciente.edad.trim() === ''
          ? null
          : Number.parseInt(datosNuevoPaciente.edad, 10)

      const payload = {
        ...datosNuevoPaciente,
        edad: Number.isFinite(edadNumerica) ? edadNumerica : null,
      }

      
      const token = localStorage.getItem('emr_token');

      const response = await fetch(API_PACIENTES_URL, {
        method: 'POST',
        headers: {
          // 2. Reemplazamos headersApiJson() por las cabeceras explícitas
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify(payload),
      })

      let data = null
      try {
        data = await response.json()
      } catch {
        data = null
      }

      if (!response.ok) {
        throw new Error(
          (data && data.error) || 'No se pudo registrar el paciente en el servidor',
        )
      }

      setPacientesRegistro((prev) => [
        ...prev,
        pacienteApiAFilaTabla(data, prev.length + 1),
      ])
      setDatosNuevoPaciente({ ...DATOS_NUEVO_PACIENTE_INICIAL })
      setModalNuevoPacienteVisible(false)
      setMensajeExito('Paciente registrado exitosamente.')
      setModalExitoVisible(true)
    } catch (error) {
      window.alert(
        error?.message || 'Ocurrió un error al registrar el paciente.',
      )
    } finally {
      setGuardandoNuevoPaciente(false)
    }
  }

  const cerrarModalEditarPaciente = () => {
    if (guardandoEdicionPaciente) return
    setIsEditModalOpen(false)
    setPacienteAEditar(null)
  }

  const abrirModalEliminar = (id) => {
    setPacienteAEliminarId(id)
    setModalEliminarVisible(true)
  }

  const cerrarModalEliminar = () => {
    if (eliminandoPaciente) return
    setModalEliminarVisible(false)
    setPacienteAEliminarId(null)
  }

  const confirmarEliminacion = async () => {
    if (!pacienteAEliminarId) return

    setEliminandoPaciente(true)
    try {
      const response = await fetch(
        `${API_PACIENTES_URL}/${encodeURIComponent(pacienteAEliminarId)}`,
        { method: 'DELETE', headers: headersApiAuth() },
      )

      if (!response.ok) {
        let data = null
        try {
          data = await response.json()
        } catch {
          data = null
        }
        throw new Error(
          (data && data.error) || 'No se pudo eliminar el paciente en el servidor',
        )
      }

      const idEliminado = pacienteAEliminarId
      setPacientesRegistro((prev) => prev.filter((p) => p.id !== idEliminado))

      if (pacientePerfilId === idEliminado) {
        setPacientePerfilId(null)
        setVistaPacientes('tabla')
      }

      if (pacienteAEditar?.id === idEliminado) {
        setIsEditModalOpen(false)
        setPacienteAEditar(null)
      }

      setModalEliminarVisible(false)
      setPacienteAEliminarId(null)
      toast.success('Paciente eliminado correctamente')
    } catch (error) {
      toast.error(
        error?.message || 'Ocurrió un error al intentar eliminar el paciente.',
      )
    } finally {
      setEliminandoPaciente(false)
    }
  }

  const actualizarCampoPacienteEditar = (campo, valor) => {
    setPacienteAEditar((prev) => (prev ? { ...prev, [campo]: valor } : null))
  }

  const cargarEvolucionesPaciente = async (paciente) => {
    const uuidPaciente = resolverUuidPaciente(paciente)
    if (!uuidPaciente) {
      setEvolucionesPrevias([])
      return []
    }

    try {
      const response = await fetch(
        `${API_EVOLUCIONES_URL}/paciente/${encodeURIComponent(uuidPaciente)}`,
        { headers: headersApiAuth() },
      )
      if (!response.ok) {
        setEvolucionesPrevias([])
        return []
      }
      const data = await response.json()
      const filas = Array.isArray(data) ? data : []
      setEvolucionesPrevias(filas)
      return filas
    } catch {
      setEvolucionesPrevias([])
      return []
    }
  }

  const guardarEvolucionConsulta = async (
    consultaId,
    pacienteId,
    evolucionIdOverride = null,
  ) => {
    const payload = {
      consulta_id: consultaId,
      paciente_id: pacienteId,
      fecha_evolucion:
        evolucionCitaActual.fecha || new Date().toISOString().slice(0, 10),
      evolucion_procedimiento: evolucionCitaActual.evolucionProcedimiento.trim(),
      firma_profesional: evolucionCitaActual.firmaProfesional.trim(),
    }

    const evolucionId = evolucionIdOverride ?? evolucionEdicionId
    const bodyEvolucion = evolucionId
      ? {
          fecha_evolucion: payload.fecha_evolucion,
          evolucion_procedimiento: payload.evolucion_procedimiento,
          firma_profesional: payload.firma_profesional,
        }
      : payload

    const response = await fetch(
      evolucionId
        ? `${API_EVOLUCIONES_URL}/${encodeURIComponent(evolucionId)}`
        : API_EVOLUCIONES_URL,
      {
        method: evolucionId ? 'PUT' : 'POST',
        headers: headersApiJson(),
        body: JSON.stringify(bodyEvolucion),
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
        (data && data.error) || 'Error al guardar la evolución clínica',
      )
    }

    return data
  }

  const guardarCambiosPaciente = async () => {
    if (!pacienteAEditar) return
    setGuardandoEdicionPaciente(true)
    try {
      const uuidPaciente = resolverUuidPaciente(pacienteAEditar)
      if (!uuidPaciente) {
        throw new Error(
          'No se encontró el UUID del paciente. Recargue la lista e intente de nuevo.',
        )
      }

      const payload = {
        nombre_completo: pacienteAEditar.nombre_completo.trim(),
        edad: Number(pacienteAEditar.edad),
        telefono: (pacienteAEditar.telefono ?? '').trim(),
        peso: normalizarMedidaPerfil(pacienteAEditar.peso).trim(),
        altura: normalizarMedidaPerfil(pacienteAEditar.altura).trim(),
        documento_identidad: (pacienteAEditar.documento_identidad ?? '').trim(),
        estado: pacienteAEditar.estado,
      }

      const response = await fetch(
        `${API_PACIENTES_URL}/${encodeURIComponent(uuidPaciente)}`,
        {
          method: 'PUT',
          headers: headersApiJson(),
          body: JSON.stringify(payload),
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
          (data && data.error) || 'No se pudo actualizar el paciente',
        )
      }

      setPacientesRegistro((prev) =>
        prev.map((p) =>
          p.id === pacienteAEditar.id || resolverUuidPaciente(p) === uuidPaciente
            ? {
                ...pacienteApiAFilaTabla(data, p.numero_historia),
                estado: data.estado ?? pacienteAEditar.estado,
              }
            : p,
        ),
      )
      toast.success('Paciente actualizado correctamente')
      setIsEditModalOpen(false)
      setPacienteAEditar(null)
    } catch (error) {
      toast.error(
        error instanceof Error
          ? error.message
          : 'No se pudo actualizar el paciente',
      )
    } finally {
      setGuardandoEdicionPaciente(false)
    }
  }

  const actualizarCampoConsulta = (campo, valor) => {
    setDatosFormularioConsulta((prev) => ({ ...prev, [campo]: valor }))
  }

  const insertarPlantillaHallazgos = (plantilla) => {
    setDatosFormularioConsulta((prev) => ({
      ...prev,
      hallazgosGenerales: insertarPlantillaEnCampo(
        prev.hallazgosGenerales,
        plantilla,
      ),
    }))
  }

  const iniciarNuevaConsulta = async (paciente) => {
    setConsultaEdicionId(null)
    setEvolucionEdicionId(null)
    setPacientePerfilId(resolverUuidPaciente(paciente) ?? paciente.id)
    setDatosFormularioConsulta(crearFormularioDesdePaciente(paciente))
    setEvolucionCitaActual(crearEvolucionCitaVacia())
    await cargarEvolucionesPaciente(paciente)
    setModalidadHistoriaClinica('consulta_existente')
    setOrigenFormulario('perfil')
    setPasoFormulario(1)
    setVistaPacientes('formulario')
  }

  const iniciarEdicionConsultaHistorica = async (paciente, consulta) => {
    setConsultaEdicionId(consulta.id)
    setEvolucionEdicionId(null)
    setPacientePerfilId(resolverUuidPaciente(paciente) ?? paciente.id)

    const notasParseadas = parseNotasMedicasConsulta(consulta.notas_medicas)
    setDatosFormularioConsulta({
      ...crearFormularioDesdePaciente(paciente),
      motivoConsulta: consulta.motivo_consulta ?? '',
      ...notasParseadas,
    })

    const evolucionesPaciente = await cargarEvolucionesPaciente(paciente)
    setEvolucionesPrevias(
      evolucionesPaciente.filter((item) => item.consulta_id !== consulta.id),
    )

    try {
      const responseEvolucion = await fetch(
        `${API_EVOLUCIONES_URL}/consulta/${encodeURIComponent(consulta.id)}`,
        { headers: headersApiAuth() },
      )
      if (responseEvolucion.ok) {
        const evolucion = await responseEvolucion.json()
        if (evolucion) {
          setEvolucionEdicionId(evolucion.id)
          setEvolucionCitaActual({
            fecha:
              fechaPostgresAInputDate(evolucion.fecha_evolucion) ||
              crearEvolucionCitaVacia().fecha,
            evolucionProcedimiento: evolucion.evolucion_procedimiento ?? '',
            firmaProfesional: evolucion.firma_profesional ?? '',
          })
        } else {
          setEvolucionCitaActual(crearEvolucionCitaVacia())
        }
      }
    } catch {
      setEvolucionCitaActual(crearEvolucionCitaVacia())
    }

    setModalidadHistoriaClinica('edicion_historica')
    setOrigenFormulario('perfil')
    setPasoFormulario(1)
    setVistaPacientes('formulario')
  }

  const iniciarRegistroNuevoPaciente = () => {
    setConsultaEdicionId(null)
    setEvolucionEdicionId(null)
    setDatosFormularioConsulta({ ...FORMULARIO_CONSULTA_VACIO })
    setEvolucionesPrevias([])
    setEvolucionCitaActual(crearEvolucionCitaVacia())
    setModalidadHistoriaClinica('nuevo_paciente')
    setOrigenFormulario('tabla')
    setPacientePerfilId(null)
    setPasoFormulario(1)
    setVistaPacientes('formulario')
  }

  const cerrarFormularioConsulta = () => {
    setPasoFormulario(1)
    setDatosFormularioConsulta({ ...FORMULARIO_CONSULTA_VACIO })
    setEvolucionesPrevias([])
    setEvolucionCitaActual(crearEvolucionCitaVacia())
    setConsultaEdicionId(null)
    setEvolucionEdicionId(null)
    setModalidadHistoriaClinica('nuevo_paciente')
    if (origenFormulario === 'perfil' && pacientePerfilId) {
      setVistaPacientes('perfil')
    } else {
      setVistaPacientes('tabla')
      setPacientePerfilId(null)
    }
    setOrigenFormulario('tabla')
  }

  const esEdicionHistorica = modalidadHistoriaClinica === 'edicion_historica'
  const esPacienteExistenteEnConsulta =
    modalidadHistoriaClinica === 'consulta_existente' || esEdicionHistorica

  const actualizarConsultaHistorica = async () => {
    if (!consultaEdicionId) {
      throw new Error('No se encontró la consulta a actualizar')
    }

    const pacienteBase = pacientesRegistro.find(
      (p) =>
        p.id === pacientePerfilId ||
        resolverUuidPaciente(p) === pacientePerfilId,
    )
    const pacienteId =
      resolverUuidPaciente(pacienteBase) ??
      (pacientePerfilId && !esCodigoVisualPaciente(String(pacientePerfilId))
        ? String(pacientePerfilId).trim()
        : null)
    if (!pacienteId || esCodigoVisualPaciente(pacienteId)) {
      throw new Error('No se encontró el UUID del paciente')
    }

    const responseConsulta = await fetch(
      `${API_CONSULTAS_URL}/${encodeURIComponent(consultaEdicionId)}`,
      {
        method: 'PUT',
        headers: headersApiJson(),
        body: JSON.stringify({
          motivo_consulta: datosFormularioConsulta.motivoConsulta.trim(),
          notas_medicas: construirNotasMedicasConsulta(datosFormularioConsulta),
        }),
      },
    )

    let dataConsulta = null
    try {
      dataConsulta = await responseConsulta.json()
    } catch {
      dataConsulta = null
    }

    if (!responseConsulta.ok) {
      throw new Error(
        (dataConsulta && dataConsulta.error) ||
          'Error al actualizar la consulta histórica',
      )
    }

    await guardarEvolucionConsulta(
      consultaEdicionId,
      pacienteId,
      evolucionEdicionId,
    )

    return dataConsulta
  }

  const registrarConsultaPacienteExistente = async () => {
    const pacienteBase = pacientesRegistro.find(
      (p) =>
        p.id === pacientePerfilId ||
        resolverUuidPaciente(p) === pacientePerfilId,
    )
    const pacienteId =
      resolverUuidPaciente(pacienteBase) ??
      (pacientePerfilId && !esCodigoVisualPaciente(String(pacientePerfilId))
        ? String(pacientePerfilId).trim()
        : null)
    if (!pacienteId || esCodigoVisualPaciente(pacienteId)) {
      throw new Error('No se encontró el UUID del paciente')
    }

    const motivoConsulta =
      datosFormularioConsulta.motivoConsulta?.trim?.() ?? ''
    const notasMedicas =
      construirNotasMedicasConsulta(datosFormularioConsulta) ?? ''

    const responseConsulta = await fetch(API_CONSULTAS_URL, {
      method: 'POST',
      headers: headersApiJson(),
      body: JSON.stringify({
        paciente_id: pacienteId,
        motivo_consulta: motivoConsulta,
        notas_medicas: notasMedicas,
      }),
    })

    let dataConsulta = null
    try {
      dataConsulta = await responseConsulta.json()
    } catch {
      dataConsulta = null
    }

    if (!responseConsulta.ok) {
      throw new Error(
        (dataConsulta && dataConsulta.error) ||
          'Error al registrar la consulta',
      )
    }

    if (!pacienteBase) return dataConsulta

    const payloadActualizacion = {
      ...construirPayloadActualizarPaciente(
        pacienteBase,
        datosFormularioConsulta,
      ),
      documento_identidad: pacienteBase.documento_identidad ?? '',
      estado: pacienteBase.estado,
    }

    const responsePaciente = await fetch(
      `${API_PACIENTES_URL}/${encodeURIComponent(pacienteId)}`,
      {
        method: 'PUT',
        headers: headersApiJson(),
        body: JSON.stringify(payloadActualizacion),
      },
    )

    let dataPaciente = null
    try {
      dataPaciente = await responsePaciente.json()
    } catch {
      dataPaciente = null
    }

    if (responsePaciente.ok && dataPaciente) {
      setPacientesRegistro((prev) =>
        prev.map((p) =>
          p.id === pacientePerfilId || resolverUuidPaciente(p) === pacienteId
            ? {
                ...pacienteApiAFilaTabla(dataPaciente, p.numero_historia),
                estado: p.estado,
              }
            : p,
        ),
      )
    }

    if (dataConsulta?.id) {
      await guardarEvolucionConsulta(dataConsulta.id, pacienteId)
    }

    return dataConsulta
  }

  const registrarConsultaPacienteNuevo = async (pacienteId) => {
    const motivoConsulta =
      datosFormularioConsulta.motivoConsulta?.trim?.() ?? ''
    const notasMedicas =
      construirNotasMedicasConsulta(datosFormularioConsulta) ?? ''

    const responseConsulta = await fetch(API_CONSULTAS_URL, {
      method: 'POST',
      headers: headersApiJson(),
      body: JSON.stringify({
        paciente_id: pacienteId,
        motivo_consulta: motivoConsulta,
        notas_medicas: notasMedicas,
      }),
    })

    let dataConsulta = null
    try {
      dataConsulta = await responseConsulta.json()
    } catch {
      dataConsulta = null
    }

    if (!responseConsulta.ok) {
      throw new Error(
        (dataConsulta && dataConsulta.error) ||
          'Error al registrar la consulta inicial',
      )
    }

    if (dataConsulta?.id) {
      await guardarEvolucionConsulta(dataConsulta.id, pacienteId)
    }

    return dataConsulta
  }

  const handleSubmit = async () => {
    const payload = construirPayloadPacienteApi(datosFormularioConsulta)

    const response = await fetch(API_PACIENTES_URL, {
      method: 'POST',
      headers: headersApiJson(),
      body: JSON.stringify(payload),
    })

    let data = null
    try {
      data = await response.json()
    } catch {
      data = null
    }

    if (!response.ok) {
      const mensaje =
        (data && data.error) ||
        `Error del servidor (${response.status}). No se pudo guardar el paciente.`
      toast.error(mensaje)
      window.alert(`Error: ${mensaje}`)
      throw new Error(mensaje)
    }

    return data
  }

  const imprimirInformeClinico = () => {
    const element = document.getElementById('formulario-pdf')
    const pasos = element?.querySelectorAll('[data-formulario-paso]') ?? []
    pasos.forEach((paso) => paso.classList.remove('hidden'))

    window.print()

    pasos.forEach((paso) => {
      const numeroPaso = Number(paso.getAttribute('data-formulario-paso'))
      if (numeroPaso !== pasoFormulario) {
        paso.classList.add('hidden')
      }
    })
  }

  const guardarHistoriaYExportar = async () => {
    setGuardandoHistoria(true)
    const esConsultaPacienteExistente =
      modalidadHistoriaClinica === 'consulta_existente'
    try {
      if (esEdicionHistorica) {
        await actualizarConsultaHistorica()
        setTokenRecargaHistorialPerfil((prev) => prev + 1)
        toast.success('Consulta histórica actualizada correctamente')
        cerrarFormularioConsulta()
        return
      }

      if (esConsultaPacienteExistente) {
        await registrarConsultaPacienteExistente()
        setVistaPacientes('perfil')
        setTokenRecargaHistorialPerfil((prev) => prev + 1)
      } else {
        const pacienteGuardado = await handleSubmit()
        const uuidNuevoPaciente = pacienteGuardado?.id
        setPacientesRegistro((prev) => [
          ...prev,
          pacienteApiAFilaTabla(pacienteGuardado, prev.length + 1),
        ])
        if (uuidNuevoPaciente) {
          await registrarConsultaPacienteNuevo(uuidNuevoPaciente)
        }
        window.alert('Paciente guardado correctamente en el servidor.')
      }

      await generarPDF()
      toast.success(
        esConsultaPacienteExistente
          ? 'Nueva consulta guardada correctamente'
          : 'Paciente registrado correctamente en el servidor',
      )
      cerrarFormularioConsulta()
    } catch (error) {
      if (!error?.message) {
        toast.error('No se pudo guardar. Intente de nuevo.')
        window.alert('Error: No se pudo guardar. Intente de nuevo.')
      }
    } finally {
      setGuardandoHistoria(false)
    }
  }

  if (!isAuthenticated) {
    return (
      <>
        <Toaster {...TOAST_OPTIONS} />
        <Login onLoginExitoso={() => setIsAuthenticated(true)} />
      </>
    )
  }

  return (
    <>
      <Toaster {...TOAST_OPTIONS} />
    <div className="flex h-screen overflow-hidden bg-slate-50">
      {/* Sidebar */}
      <aside className="no-print flex w-64 shrink-0 flex-col bg-slate-900 text-slate-300">
        <div className="border-b border-slate-800 px-6 py-5">
          <p className="text-xs font-semibold uppercase tracking-widest text-slate-500">
            EMR
          </p>
          <h1 className="mt-1 text-lg font-semibold text-white">Medico</h1>
        </div>

        <nav className="flex-1 px-3 py-4">
          <ul className="space-y-1">
            {navItems.map((item) => (
              <li key={item.seccion}>
                <button
                  type="button"
                  onClick={() => {
                    setSeccionActual(item.seccion)
                    if (item.seccion !== 'pacientes') {
                      setVistaPacientes('tabla')
                      setPacientePerfilId(null)
                      setPasoFormulario(1)
                      setOrigenFormulario('tabla')
                    }
                  }}
                  className={`flex w-full items-center gap-2.5 rounded-md px-3 py-2 text-left text-sm font-medium transition-colors ${
                    seccionActual === item.seccion
                      ? 'bg-slate-800 text-white'
                      : 'text-slate-400 hover:bg-slate-800/60 hover:text-white'
                  }`}
                >
                  <item.icon
                    className="h-4 w-4 shrink-0 opacity-90"
                    aria-hidden="true"
                  />
                  {item.label}
                </button>
              </li>
            ))}
          </ul>
        </nav>

        <div className="border-t border-slate-800 px-3 py-4">
          <button
            type="button"
            onClick={() => {
              localStorage.removeItem('emr_token')
              setIsAuthenticated(false)
            }}
            className="w-full rounded-md px-3 py-2 text-left text-sm font-medium text-slate-400 transition-colors hover:bg-slate-800/60 hover:text-white"
          >
            Cerrar Sesión
          </button>
          <p className="mt-3 px-3 text-xs text-slate-500">Book of Business</p>
        </div>
      </aside>

      {/* Main content */}
      <div className="flex min-w-0 flex-1 flex-col">
        {/* Top header */}
        <header className="no-print border-b border-slate-200 bg-white px-6 py-4">
          <div className="flex items-center justify-between gap-4">
            <div>
              <h2 className="text-lg font-semibold text-slate-900">
                {navItems.find((item) => item.seccion === seccionActual)?.label ??
                  'Pacientes'}
              </h2>
              <p className="text-sm text-slate-500">
                {seccionActual === 'pacientes' && vistaPacientes === 'perfil'
                  ? pacientePerfilSeleccionado?.nombre_completo ??
                    'Expediente del paciente'
                  : seccionActual === 'dashboard'
                    ? 'Centro de operaciones y agenda del día'
                    : seccionActual === 'citas'
                      ? 'Agenda clínica, calendario y citas del día'
                    : seccionActual === 'reportes'
                      ? 'Métricas operativas y demografía de pacientes'
                      : seccionActual === 'finanzas'
                        ? 'Control de ingresos, cuentas por cobrar y análisis de tratamientos'
                        : seccionActual === 'pacientes'
                        ? 'Gestión de cartera y registros clínicos'
                        : 'Panel del módulo'}
              </p>
            </div>

            {seccionActual === 'pacientes' && vistaPacientes === 'tabla' && (
              <div className="flex w-full max-w-xl items-center gap-3">
                <div className="relative flex-1">
                  <svg
                    className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400"
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
                      d="m21 21-5.197-5.197m0 0A7.5 7.5 0 1 0 5.196 5.196a7.5 7.5 0 0 0 10.607 10.607Z"
                    />
                  </svg>
                  <input
                    type="search"
                    value={busquedaPacientes}
                    onChange={(e) => setBusquedaPacientes(e.target.value)}
                    placeholder="Buscar por nombre, PAC-001 o documento..."
                    className="w-full rounded-lg border border-slate-200 bg-slate-50 py-2 pl-10 pr-4 text-sm text-slate-800 placeholder:text-slate-400 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
                  />
                </div>

                <button
                  type="button"
                  onClick={() => setModalNuevoPacienteVisible(true)}
                  className="shrink-0 rounded-lg bg-blue-800 px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-blue-900"
                >
                  + Nuevo Paciente
                </button>
              </div>
            )}
          </div>
        </header>

        <main className="flex-1 overflow-auto p-6">
          {seccionActual === 'dashboard' ? (
            <DashboardFinanciero
              onIniciarConsulta={() => {
                setSeccionActual('pacientes')
                setVistaPacientes('tabla')
                setPacientePerfilId(null)
              }}
              onAgendarCita={() => {
                setSeccionActual('citas')
                setAbrirModalCitasDesdeDashboard(true)
              }}
            />
          ) : seccionActual === 'pacientes' && vistaPacientes === 'tabla' ? (
            <>
            <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
              <div className="overflow-x-auto">
                <table className="w-full min-w-[800px] border-collapse text-left">
                  <thead>
                    <tr className="border-b border-slate-200 bg-slate-100">
                      <th className="px-6 py-4 text-xs font-bold uppercase tracking-wider text-slate-700">
                        ID
                      </th>
                      <th className="px-6 py-4 text-xs font-bold uppercase tracking-wider text-slate-700">
                        Nombre
                      </th>
                      <th className="px-6 py-4 text-xs font-bold uppercase tracking-wider text-slate-700">
                        Edad
                      </th>
                      <th className="px-6 py-4 text-xs font-bold uppercase tracking-wider text-slate-700">
                        Cédula
                      </th>
                      <th className="px-6 py-4 text-xs font-bold uppercase tracking-wider text-slate-700">
                        Estado
                      </th>
                      <th className="px-6 py-4 text-xs font-bold uppercase tracking-wider text-slate-700">
                        Acciones
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {pacientesFiltrados.length === 0 ? (
                      <tr>
                        <td
                          colSpan={6}
                          className="px-6 py-12 text-center text-sm text-slate-500"
                        >
                          No se encontraron pacientes con ese criterio de búsqueda.
                        </td>
                      </tr>
                    ) : (
                      pacientesFiltrados.map((paciente, indice) => (
                        <tr
                          key={paciente.id}
                          className={`border-b border-slate-100 last:border-b-0 ${
                            indice % 2 === 0 ? 'bg-white' : 'bg-slate-50/90'
                          }`}
                        >
                          <td className="whitespace-nowrap px-6 py-4 text-sm font-medium text-slate-600">
                            {paciente.codigo_visual ??
                              formatearNumeroHistoria(paciente.numero_historia)}
                          </td>
                          <td className="whitespace-nowrap px-6 py-4 text-sm font-semibold text-slate-900">
                            {paciente.nombre_completo}
                          </td>
                          <td className="whitespace-nowrap px-6 py-4 text-sm text-slate-700">
                            {paciente.edad}
                          </td>
                          <td className="whitespace-nowrap px-6 py-4 text-sm text-slate-700">
                            {paciente.documento_identidad || '—'}
                          </td>
                          <td className="whitespace-nowrap px-6 py-4">
                            <span
                              className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ring-1 ring-inset ${
                                estadoBadgeStyles[paciente.estado] ??
                                'bg-slate-50 text-slate-600 ring-slate-500/20'
                              }`}
                            >
                              {paciente.estado}
                            </span>
                          </td>
                          <td className="whitespace-nowrap px-6 py-4">
                            <div className="flex flex-wrap items-center gap-2">
                              <button
                                type="button"
                                onClick={() => abrirPerfilPaciente(paciente.id)}
                                className="rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-blue-800 transition-colors hover:bg-blue-50"
                              >
                                Ver Perfil
                              </button>
                              <button
                                type="button"
                                onClick={() => abrirModalEditarPaciente(paciente)}
                                className="rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 transition-colors hover:bg-slate-50"
                              >
                                Editar
                              </button>
                              <button
                                type="button"
                                onClick={() => abrirModalEliminar(paciente.id)}
                                className="rounded-lg border border-red-200 bg-red-50 px-3 py-1.5 text-xs font-semibold text-red-700 transition-colors hover:bg-red-100"
                              >
                                Eliminar
                              </button>
                            </div>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>

            {isEditModalOpen && pacienteAEditar && (
              <div
                className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4"
                role="dialog"
                aria-modal="true"
                aria-labelledby="editar-paciente-titulo"
              >
                <div className="w-full max-w-lg rounded-2xl border border-slate-200 bg-white shadow-2xl">
                  <div className="border-b border-slate-100 px-6 py-4">
                    <h4
                      id="editar-paciente-titulo"
                      className="text-lg font-bold text-slate-900"
                    >
                      Editar paciente
                    </h4>
                    <p className="mt-1 text-sm text-slate-500">
                      ID:{' '}
                      {pacienteAEditar.codigo_visual ??
                        formatearNumeroHistoria(pacienteAEditar.numero_historia)}
                    </p>
                  </div>

                  <form
                    className="space-y-4 px-6 py-5"
                    onSubmit={(e) => {
                      e.preventDefault()
                      guardarCambiosPaciente()
                    }}
                  >
                    <div>
                      <label className="mb-1.5 block text-sm font-medium text-slate-700">
                        Nombre
                      </label>
                      <input
                        type="text"
                        required
                        value={pacienteAEditar.nombre_completo}
                        onChange={(e) =>
                          actualizarCampoPacienteEditar(
                            'nombre_completo',
                            e.target.value,
                          )
                        }
                        className={inputClinico}
                      />
                    </div>

                    <div>
                      <label className="mb-1.5 block text-sm font-medium text-slate-700">
                        Edad
                      </label>
                      <input
                        type="number"
                        min={0}
                        max={120}
                        required
                        value={pacienteAEditar.edad}
                        onChange={(e) =>
                          actualizarCampoPacienteEditar('edad', e.target.value)
                        }
                        className={inputClinico}
                      />
                    </div>

                    <div>
                      <label className="mb-1.5 block text-sm font-medium text-slate-700">
                        Teléfono
                      </label>
                      <input
                        type="text"
                        value={pacienteAEditar.telefono ?? ''}
                        onChange={(e) =>
                          actualizarCampoPacienteEditar('telefono', e.target.value)
                        }
                        placeholder="Ej. +58 412 1234567"
                        className={inputClinico}
                      />
                    </div>

                    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                      <div>
                        <label className="mb-1.5 block text-sm font-medium text-slate-700">
                          Peso
                        </label>
                        <input
                          type="text"
                          value={
                            pacienteAEditar.peso === '—'
                              ? ''
                              : (pacienteAEditar.peso ?? '')
                          }
                          onChange={(e) =>
                            actualizarCampoPacienteEditar('peso', e.target.value)
                          }
                          placeholder="Ej. 68 kg"
                          className={inputClinico}
                        />
                      </div>
                      <div>
                        <label className="mb-1.5 block text-sm font-medium text-slate-700">
                          Altura
                        </label>
                        <input
                          type="text"
                          value={
                            pacienteAEditar.altura === '—'
                              ? ''
                              : (pacienteAEditar.altura ?? '')
                          }
                          onChange={(e) =>
                            actualizarCampoPacienteEditar('altura', e.target.value)
                          }
                          placeholder="Ej. 1.65 m"
                          className={inputClinico}
                        />
                      </div>
                    </div>

                    <div>
                      <label className="mb-1.5 block text-sm font-medium text-slate-700">
                        Cédula
                      </label>
                      <input
                        type="text"
                        value={pacienteAEditar.documento_identidad ?? ''}
                        onChange={(e) =>
                          actualizarCampoPacienteEditar(
                            'documento_identidad',
                            e.target.value,
                          )
                        }
                        placeholder="Ej. V-12.345.678"
                        className={inputClinico}
                      />
                    </div>

                    <div>
                      <label className="mb-1.5 block text-sm font-medium text-slate-700">
                        Estado
                      </label>
                      <select
                        value={pacienteAEditar.estado}
                        onChange={(e) =>
                          actualizarCampoPacienteEditar('estado', e.target.value)
                        }
                        className={selectClinico}
                      >
                        {ESTADOS_PACIENTE_OPCIONES.map((estado) => (
                          <option key={estado} value={estado}>
                            {estado}
                          </option>
                        ))}
                      </select>
                    </div>

                    <div className="flex justify-end gap-3 border-t border-slate-100 pt-4">
                      <button
                        type="button"
                        onClick={cerrarModalEditarPaciente}
                        disabled={guardandoEdicionPaciente}
                        className="rounded-lg border border-slate-200 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-60"
                      >
                        Cancelar
                      </button>
                      <button
                        type="submit"
                        disabled={guardandoEdicionPaciente}
                        className="inline-flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-70"
                      >
                        {guardandoEdicionPaciente ? (
                          <>
                            <span
                              className="h-4 w-4 animate-spin rounded-full border-2 border-white/30 border-t-white"
                              aria-hidden="true"
                            />
                            Guardando...
                          </>
                        ) : (
                          'Guardar Cambios'
                        )}
                      </button>
                    </div>
                  </form>
                </div>
              </div>
            )}

            {modalNuevoPacienteVisible && (
              <div
                className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4"
                role="dialog"
                aria-modal="true"
                aria-labelledby="nuevo-paciente-titulo"
              >
                <div className="w-full max-w-lg rounded-2xl border border-slate-200 bg-white shadow-2xl">
                  <div className="border-b border-slate-100 px-6 py-4">
                    <h4
                      id="nuevo-paciente-titulo"
                      className="text-lg font-bold text-slate-900"
                    >
                      Registrar Nuevo Paciente
                    </h4>
                    <p className="mt-1 text-sm text-slate-500">
                      Datos demográficos básicos. La historia clínica se completa
                      en una consulta posterior.
                    </p>
                  </div>

                  <form className="space-y-4 px-6 py-5" onSubmit={crearPaciente}>
                    <div>
                      <label className="mb-1.5 block text-sm font-medium text-slate-700">
                        Nombre Completo
                      </label>
                      <input
                        type="text"
                        required
                        value={datosNuevoPaciente.nombre_completo}
                        onChange={(e) =>
                          actualizarCampoNuevoPaciente(
                            'nombre_completo',
                            e.target.value,
                          )
                        }
                        className={inputClinico}
                      />
                    </div>

                    <div>
                      <label className="mb-1.5 block text-sm font-medium text-slate-700">
                        Documento de Identidad
                      </label>
                      <input
                        type="text"
                        required
                        value={datosNuevoPaciente.documento_identidad}
                        onChange={(e) =>
                          actualizarCampoNuevoPaciente(
                            'documento_identidad',
                            e.target.value,
                          )
                        }
                        className={inputClinico}
                      />
                    </div>

                    <div>
                      <label className="mb-1.5 block text-sm font-medium text-slate-700">
                        Edad
                      </label>
                      <input
                        type="number"
                        min={0}
                        max={120}
                        required
                        value={datosNuevoPaciente.edad}
                        onChange={(e) =>
                          actualizarCampoNuevoPaciente('edad', e.target.value)
                        }
                        className={inputClinico}
                      />
                    </div>

                    <div>
                      <label className="mb-1.5 block text-sm font-medium text-slate-700">
                        Sexo
                      </label>
                      <select
                        required
                        value={datosNuevoPaciente.sexo}
                        onChange={(e) =>
                          actualizarCampoNuevoPaciente('sexo', e.target.value)
                        }
                        className={selectClinico}
                      >
                        <option value="" disabled>
                          Seleccione…
                        </option>
                        {SEXO_PACIENTE_OPCIONES.map((opcion) => (
                          <option key={opcion} value={opcion}>
                            {opcion}
                          </option>
                        ))}
                      </select>
                    </div>

                    <div>
                      <label className="mb-1.5 block text-sm font-medium text-slate-700">
                        Teléfono
                      </label>
                      <input
                        type="text"
                        value={datosNuevoPaciente.telefono}
                        onChange={(e) =>
                          actualizarCampoNuevoPaciente('telefono', e.target.value)
                        }
                        placeholder="Ej. +58 412 1234567"
                        className={inputClinico}
                      />
                    </div>

                    <div className="flex justify-end gap-3 border-t border-slate-100 pt-4">
                      <button
                        type="button"
                        onClick={cerrarModalNuevoPaciente}
                        disabled={guardandoNuevoPaciente}
                        className="rounded-lg border border-slate-200 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-60"
                      >
                        Cancelar
                      </button>
                      <button
                        type="submit"
                        disabled={guardandoNuevoPaciente}
                        className="inline-flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-70"
                      >
                        {guardandoNuevoPaciente ? (
                          <>
                            <span
                              className="h-4 w-4 animate-spin rounded-full border-2 border-white/30 border-t-white"
                              aria-hidden="true"
                            />
                            Guardando...
                          </>
                        ) : (
                          'Registrar Paciente'
                        )}
                      </button>
                    </div>
                  </form>
                </div>
              </div>
            )}
            </>
          ) : seccionActual === 'pacientes' && vistaPacientes === 'perfil' ? (
            <PerfilPaciente
              paciente={pacientePerfilSeleccionado}
              estadoBadgeStyles={estadoBadgeStyles}
              onVolver={volverAListaPacientes}
              onNuevaConsulta={iniciarNuevaConsulta}
              onVerEditarConsulta={iniciarEdicionConsultaHistorica}
              recargaHistorialToken={tokenRecargaHistorialPerfil}
            />
          ) : seccionActual === 'pacientes' && vistaPacientes === 'formulario' ? (
            <section className="flex flex-col gap-6">
              <div className="no-print flex items-center justify-end">
                <span className="rounded-full bg-slate-100 px-4 py-1.5 text-sm font-medium text-slate-700">
                  Paso {pasoFormulario} de 4
                </span>
              </div>

              <div
                id="formulario-pdf"
                className="historia-clinica-print space-y-6"
              >
                <header>
                  <h3 className="text-xl font-semibold text-slate-900">
                    {esEdicionHistorica
                      ? 'Edición de Consulta Histórica'
                      : modalidadHistoriaClinica === 'consulta_existente'
                        ? 'Nueva Consulta'
                        : 'Nueva Historia Clínica'}
                  </h3>
                  <p className="mt-1 text-sm text-slate-500">
                    {esEdicionHistorica
                      ? 'Modifique la anamnesis, signos vitales y evolución de la consulta seleccionada.'
                      : esPacienteExistenteEnConsulta
                        ? 'Datos del paciente cargados desde el expediente. Complete la información de la consulta actual.'
                        : 'Asistente de registro paso a paso'}
                  </p>
                </header>

                <div className="min-h-[400px] rounded-lg border border-slate-200 bg-white p-8">
                  <div
                    className={pasoFormulario === 1 ? 'space-y-6' : 'hidden'}
                    data-formulario-paso="1"
                  >
                    <section className="space-y-4 rounded-2xl border border-gray-200 bg-white p-6 shadow-sm">
                      <h2 className="border-b border-gray-200 pb-3 text-sm font-bold uppercase tracking-wider text-blue-600">
                        1. Datos Personales del Paciente
                      </h2>
                      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-5">
                        <div>
                          <label className="mb-1.5 block text-sm font-medium text-gray-800">
                            Nombre Completo
                          </label>
                          <input
                            type="text"
                            readOnly={esPacienteExistenteEnConsulta}
                            value={datosFormularioConsulta.nombreCompleto}
                            onChange={(e) =>
                              actualizarCampoConsulta(
                                'nombreCompleto',
                                e.target.value,
                              )
                            }
                            placeholder="Ej. Juan Pérez"
                            className={
                              esPacienteExistenteEnConsulta
                                ? inputSoloLectura
                                : inputClinico
                            }
                          />
                        </div>
                        <div>
                          <label className="mb-1.5 block text-sm font-medium text-gray-800">
                            Documento Identificación
                          </label>
                          <input
                            type="text"
                            readOnly={esPacienteExistenteEnConsulta}
                            value={datosFormularioConsulta.documentoIdentidad}
                            onChange={(e) =>
                              actualizarCampoConsulta(
                                'documentoIdentidad',
                                e.target.value,
                              )
                            }
                            placeholder="Ej. V-12.345.678"
                            className={
                              esPacienteExistenteEnConsulta
                                ? inputSoloLectura
                                : inputClinico
                            }
                          />
                        </div>
                        <div>
                          <label className="mb-1.5 block text-sm font-medium text-gray-800">
                            Edad
                          </label>
                          <input
                            type="text"
                            readOnly={esPacienteExistenteEnConsulta}
                            value={datosFormularioConsulta.edad}
                            onChange={(e) =>
                              actualizarCampoConsulta('edad', e.target.value)
                            }
                            placeholder="Ej. 34"
                            className={
                              esPacienteExistenteEnConsulta
                                ? inputSoloLectura
                                : inputClinico
                            }
                          />
                        </div>
                        <div>
                          <label className="mb-1.5 block text-sm font-medium text-gray-800">
                            Sexo
                          </label>
                          <input
                            type="text"
                            readOnly={esPacienteExistenteEnConsulta}
                            value={datosFormularioConsulta.sexo}
                            onChange={(e) =>
                              actualizarCampoConsulta('sexo', e.target.value)
                            }
                            placeholder="Ej. Masculino"
                            className={
                              esPacienteExistenteEnConsulta
                                ? inputSoloLectura
                                : inputClinico
                            }
                          />
                        </div>
                        <div>
                          <label className="mb-1.5 block text-sm font-medium text-gray-800">
                            Teléfono
                          </label>
                          <input
                            type="text"
                            readOnly={esPacienteExistenteEnConsulta}
                            value={datosFormularioConsulta.telefono}
                            onChange={(e) =>
                              actualizarCampoConsulta('telefono', e.target.value)
                            }
                            placeholder="Ej. +58 412 1234567"
                            className={
                              esPacienteExistenteEnConsulta
                                ? inputSoloLectura
                                : inputClinico
                            }
                          />
                        </div>
                      </div>
                      {esPacienteExistenteEnConsulta && (
                        <p className="text-xs text-gray-500">
                          Datos demográficos importados del registro del paciente
                          (solo lectura).
                        </p>
                      )}
                    </section>

                    <section className="space-y-5 rounded-2xl border border-gray-200 bg-white p-6 shadow-sm">
                      <h2 className="border-b border-gray-200 pb-3 text-sm font-bold uppercase tracking-wider text-blue-600">
                        2. Anamnesis Médica y Revisión por Sistemas
                      </h2>
                      <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
                        <div>
                          <label className="mb-1.5 block text-sm font-medium text-gray-800">
                            Peso (consulta actual)
                          </label>
                          <input
                            type="text"
                            value={datosFormularioConsulta.pesoConsulta}
                            onChange={(e) =>
                              actualizarCampoConsulta(
                                'pesoConsulta',
                                e.target.value,
                              )
                            }
                            placeholder="Ej. 68 kg"
                            className={inputClinico}
                          />
                        </div>
                        <div>
                          <label className="mb-1.5 block text-sm font-medium text-gray-800">
                            Altura (consulta actual)
                          </label>
                          <input
                            type="text"
                            value={datosFormularioConsulta.alturaConsulta}
                            onChange={(e) =>
                              actualizarCampoConsulta(
                                'alturaConsulta',
                                e.target.value,
                              )
                            }
                            placeholder="Ej. 1.65 m"
                            className={inputClinico}
                          />
                        </div>
                        <div>
                          <label className="mb-1.5 block text-sm font-medium text-gray-800">
                            Presión Arterial
                          </label>
                          <input
                            type="text"
                            value={datosFormularioConsulta.presionArterial}
                            onChange={(e) =>
                              actualizarCampoConsulta(
                                'presionArterial',
                                e.target.value,
                              )
                            }
                            placeholder="Ej. 120/80 mmHg"
                            className={inputClinico}
                          />
                        </div>
                      </div>
                      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                        <div>
                          <label className="mb-1.5 block text-sm font-medium text-gray-800">
                            Motivo de Consulta
                          </label>
                          <textarea
                            rows={2}
                            value={datosFormularioConsulta.motivoConsulta}
                            onChange={(e) =>
                              actualizarCampoConsulta(
                                'motivoConsulta',
                                e.target.value,
                              )
                            }
                            placeholder="Describa el motivo de la visita..."
                            className={inputClinico}
                          />
                        </div>
                        <div>
                          <label className="mb-1.5 block text-sm font-medium text-gray-800">
                            Historia de la Enfermedad Actual
                          </label>
                          <textarea
                            rows={2}
                            value={datosFormularioConsulta.historiaEnfermedadActual}
                            onChange={(e) =>
                              actualizarCampoConsulta(
                                'historiaEnfermedadActual',
                                e.target.value,
                              )
                            }
                            placeholder="Evolución y síntomas actuales..."
                            className={inputClinico}
                          />
                        </div>
                      </div>

                      <div className="space-y-3">
                        <span className="block text-xs font-bold uppercase text-gray-800">
                          Evaluación de Antecedentes Patológicos:
                        </span>
                        <div className="grid grid-cols-1 gap-3 text-xs md:grid-cols-3">
                          <div className="space-y-2 rounded-lg border border-gray-200 p-3">
                            <span className="font-bold text-gray-800">Cardiovascular</span>
                            <label className="flex items-center gap-2 text-gray-600">
                              <input
                                type="checkbox"
                                className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                              />
                              Hipertensión Arterial (HTA)
                            </label>
                            <label className="flex items-center gap-2 text-gray-600">
                              <input
                                type="checkbox"
                                className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                              />
                              Cardiopatía / Marcapasos
                            </label>
                          </div>
                          <div className="space-y-2 rounded-lg border border-gray-200 p-3">
                            <span className="font-bold text-gray-800">Endocrino & Renal</span>
                            <label className="flex items-center gap-2 text-gray-600">
                              <input
                                type="checkbox"
                                className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                              />
                              Diabetes Mellitus
                            </label>
                            <label className="flex items-center gap-2 text-gray-600">
                              <input
                                type="checkbox"
                                className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                              />
                              Insuficiencia Renal
                            </label>
                          </div>
                          <div className="space-y-2 rounded-lg border border-gray-200 p-3">
                            <span className="font-bold text-gray-800">Hematología & Alergias</span>
                            <label className="flex items-center gap-2 text-gray-600">
                              <input
                                type="checkbox"
                                className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                              />
                              Alteración Coagulación
                            </label>
                            <label className="flex items-center gap-2 text-gray-600">
                              <input
                                type="checkbox"
                                className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                              />
                              Alergia a AINEs / Penicilina
                            </label>
                          </div>
                        </div>

                        <div className="grid grid-cols-1 gap-4 pt-2 md:grid-cols-2">
                          <div>
                            <label className="mb-1.5 block text-sm font-medium text-gray-800">
                              Hábitos Fisiológicos
                            </label>
                            <input
                              type="text"
                              value={datosFormularioConsulta.habitosFisiologicos}
                              onChange={(e) =>
                                actualizarCampoConsulta(
                                  'habitosFisiologicos',
                                  e.target.value,
                                )
                              }
                              className={inputClinico}
                            />
                          </div>
                          <div>
                            <label className="mb-1.5 block text-sm font-medium text-gray-800">
                              Tratamiento Médico Actual
                            </label>
                            <input
                              type="text"
                              value={datosFormularioConsulta.tratamientoMedicoActual}
                              onChange={(e) =>
                                actualizarCampoConsulta(
                                  'tratamientoMedicoActual',
                                  e.target.value,
                                )
                              }
                              className={inputClinico}
                            />
                          </div>
                        </div>
                      </div>
                    </section>
                  </div>
                  <section
                    className={pasoFormulario === 2 ? 'space-y-6' : 'hidden'}
                    data-formulario-paso="2"
                  >
                    <div>
                      <h2 className="text-lg font-semibold text-gray-800">
                        2. Odontodiagrama Clínico Interactivo
                      </h2>
                      <p className="mt-1 text-sm text-gray-600">
                        Haga clic en cada diente para alternar su estado clínico
                      </p>
                    </div>

                    <div className="flex flex-wrap gap-2">
                      <span className="rounded-full bg-red-100 px-3 py-1 text-xs font-medium text-red-700">
                        Caries
                      </span>
                      <span className="rounded-full bg-blue-100 px-3 py-1 text-xs font-medium text-blue-700">
                        Tratado/Obturado
                      </span>
                      <span className="rounded-full bg-green-100 px-3 py-1 text-xs font-medium text-green-700">
                        Prótesis
                      </span>
                      <span className="rounded-full bg-gray-200 px-3 py-1 text-xs font-medium text-gray-500 line-through">
                        Ausente/A extraer
                      </span>
                    </div>

                    <div className="space-y-4 rounded-2xl border border-gray-200 bg-white p-6">
                      <p className="text-center text-xs font-semibold uppercase tracking-wider text-gray-500">
                        Arcada Superior
                      </p>
                      <div className="flex items-center justify-center">
                        <div className="flex gap-2">
                          {CUADRANTE_1.map((diente) => {
                            const estado = estadoDientes[diente] || 'sano'
                            return (
                              <button
                                key={diente}
                                type="button"
                                onClick={() => cambiarEstadoDiente(diente)}
                                className={`flex h-10 w-10 items-center justify-center rounded-lg border text-xs font-semibold transition-colors hover:opacity-80 ${clasesEstadoDiente[estado]}`}
                                title={`Diente ${diente} — ${estado}`}
                              >
                                {diente}
                              </button>
                            )
                          })}
                        </div>

                        <div className="mx-3 w-1 rounded border-x border-gray-400 bg-gray-300" />

                        <div className="flex gap-2">
                          {CUADRANTE_2.map((diente) => {
                            const estado = estadoDientes[diente] || 'sano'
                            return (
                              <button
                                key={diente}
                                type="button"
                                onClick={() => cambiarEstadoDiente(diente)}
                                className={`flex h-10 w-10 items-center justify-center rounded-lg border text-xs font-semibold transition-colors hover:opacity-80 ${clasesEstadoDiente[estado]}`}
                                title={`Diente ${diente} — ${estado}`}
                              >
                                {diente}
                              </button>
                            )
                          })}
                        </div>
                      </div>

                      <div className="border-t border-dashed border-gray-200" />

                      <p className="text-center text-xs font-semibold uppercase tracking-wider text-gray-500">
                        Arcada Inferior
                      </p>
                      <div className="flex items-center justify-center">
                        <div className="flex gap-2">
                          {CUADRANTE_4.map((diente) => {
                            const estado = estadoDientes[diente] || 'sano'
                            return (
                              <button
                                key={diente}
                                type="button"
                                onClick={() => cambiarEstadoDiente(diente)}
                                className={`flex h-10 w-10 items-center justify-center rounded-lg border text-xs font-semibold transition-colors hover:opacity-80 ${clasesEstadoDiente[estado]}`}
                                title={`Diente ${diente} — ${estado}`}
                              >
                                {diente}
                              </button>
                            )
                          })}
                        </div>

                        <div className="mx-3 w-1 rounded border-x border-gray-400 bg-gray-300" />

                        <div className="flex gap-2">
                          {CUADRANTE_3.map((diente) => {
                            const estado = estadoDientes[diente] || 'sano'
                            return (
                              <button
                                key={diente}
                                type="button"
                                onClick={() => cambiarEstadoDiente(diente)}
                                className={`flex h-10 w-10 items-center justify-center rounded-lg border text-xs font-semibold transition-colors hover:opacity-80 ${clasesEstadoDiente[estado]}`}
                                title={`Diente ${diente} — ${estado}`}
                              >
                                {diente}
                              </button>
                            )
                          })}
                        </div>
                      </div>
                    </div>

                    <div className="mt-6">
                      <p className="mb-2 text-sm font-bold text-gray-800">
                        Hallazgos Generales:
                      </p>
                      <div className="mb-3 flex flex-wrap gap-2">
                        {PLANTILLAS_CLINICAS_ODONTO.map((plantilla) => (
                          <button
                            key={plantilla}
                            type="button"
                            onClick={() => insertarPlantillaHallazgos(plantilla)}
                            className="rounded-full border border-slate-200 bg-slate-100 px-3 py-1 text-xs font-medium text-slate-700 transition-colors hover:border-blue-200 hover:bg-blue-50 hover:text-blue-900"
                          >
                            {plantilla}
                          </button>
                        ))}
                      </div>
                      <textarea
                        rows={3}
                        value={datosFormularioConsulta.hallazgosGenerales}
                        onChange={(e) =>
                          actualizarCampoConsulta(
                            'hallazgosGenerales',
                            e.target.value,
                          )
                        }
                        placeholder="Notas de evolución, procedimientos y hallazgos clínicos..."
                        className="w-full rounded-lg border border-gray-200 bg-gray-50 p-3 text-sm text-gray-800 outline-none focus:ring-2 focus:ring-blue-500"
                      />
                    </div>
                  </section>
                  <div
                    className={pasoFormulario === 3 ? 'space-y-6' : 'hidden'}
                    data-formulario-paso="3"
                  >
                    <header className="space-y-1 text-center">
                      <h2 className="text-xl font-bold text-blue-900">
                        ANEXO ESPECIALIZADO: HISTORIA CLÍNICA DE ENDODONCIA
                      </h2>
                      <p className="text-sm text-gray-500">
                        Evaluación inicial, pruebas objetivas y hallazgos radiográficos
                      </p>
                    </header>

                    {/* E1: Evaluación Inicial */}
                    <section className="overflow-hidden rounded-md border border-gray-200">
                      <div className="bg-slate-700 p-2 text-sm font-bold text-white">
                        E1. Evaluación Inicial del Órgano Dentario
                      </div>
                      <div className="space-y-4 rounded-b-md border-t border-gray-200 bg-white p-4">
                        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                          <div>
                            <label className="mb-1.5 block text-sm font-medium text-gray-800">
                              Diente a tratar
                            </label>
                            <input
                              type="text"
                              placeholder="Ej. 36"
                              className={inputClinico}
                            />
                          </div>
                          <div>
                            <label className="mb-1.5 block text-sm font-medium text-gray-800">
                              Diagnóstico Médico General
                            </label>
                            <input
                              type="text"
                              placeholder="Ej. Pulpitis irreversible"
                              className={inputClinico}
                            />
                          </div>
                        </div>

                        <div className="rounded-lg bg-gray-50 p-3">
                          <p className="mb-3 text-xs font-bold uppercase tracking-wide text-gray-600">
                            Sintomatología Subjetiva
                          </p>
                          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
                            <div>
                              <label className="mb-1.5 block text-sm font-medium text-gray-800">
                                Naturaleza del Dolor
                              </label>
                              <select className={selectClinico} defaultValue="">
                                <option value="" disabled>
                                  Seleccionar...
                                </option>
                                <option>Espontáneo</option>
                                <option>Provocado</option>
                                <option>Intermitente</option>
                                <option>Continuo</option>
                              </select>
                            </div>
                            <div>
                              <label className="mb-1.5 block text-sm font-medium text-gray-800">
                                Intensidad
                              </label>
                              <select className={selectClinico} defaultValue="">
                                <option value="" disabled>
                                  Seleccionar...
                                </option>
                                <option>Leve</option>
                                <option>Moderado</option>
                                <option>Severo</option>
                              </select>
                            </div>
                            <div>
                              <label className="mb-1.5 block text-sm font-medium text-gray-800">
                                Localización
                              </label>
                              <select className={selectClinico} defaultValue="">
                                <option value="" disabled>
                                  Seleccionar...
                                </option>
                                <option>Localizado</option>
                                <option>Difuso</option>
                                <option>Irradiado</option>
                              </select>
                            </div>
                            <div>
                              <label className="mb-1.5 block text-sm font-medium text-gray-800">
                                Alivio con:
                              </label>
                              <input
                                type="text"
                                placeholder="Ej. AINEs, frío..."
                                className={inputClinico}
                              />
                            </div>
                          </div>
                        </div>
                      </div>
                    </section>

                    {/* E2: Pruebas de Diagnóstico Objetivo */}
                    <section className="overflow-hidden rounded-md border border-gray-200">
                      <div className="bg-slate-700 p-2 text-sm font-bold text-white">
                        E2. Pruebas de Diagnóstico Objetivo
                      </div>
                      <div className="space-y-3 rounded-b-md border-t border-gray-200 bg-white p-4">
                        <div className="hidden gap-4 text-xs font-semibold uppercase tracking-wide text-gray-500 md:grid md:grid-cols-[1.2fr_0.6fr_1.2fr]">
                          <span>Prueba</span>
                          <span>Resultado</span>
                          <span>Observaciones</span>
                        </div>

                        {PRUEBAS_DIAGNOSTICO_ENDODONCIA.map((prueba) => (
                          <div
                            key={prueba}
                            className="grid grid-cols-1 gap-3 border-b border-gray-100 pb-3 last:border-b-0 last:pb-0 md:grid-cols-[1.2fr_0.6fr_1.2fr] md:items-center md:gap-4"
                          >
                            <span className="text-sm font-medium text-gray-800">
                              {prueba}
                            </span>
                            <select className={selectClinico} defaultValue="-">
                              <option>-</option>
                              <option>+</option>
                              <option>Dudoso</option>
                            </select>
                            <input
                              type="text"
                              placeholder="Observaciones..."
                              className={inputClinico}
                            />
                          </div>
                        ))}
                      </div>
                    </section>

                    {/* E3: Hallazgos Radiográficos */}
                    <section className="overflow-hidden rounded-md border border-gray-200">
                      <div className="bg-slate-700 p-2 text-sm font-bold text-white">
                        E3. Hallazgos Radiográficos
                      </div>
                      <div className="space-y-4 rounded-b-md border-t border-gray-200 bg-white p-4">
                        <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
                          <div className="space-y-2 rounded-lg border border-gray-200 p-3">
                            <p className="text-sm font-bold text-gray-800">Corona</p>
                            <label className="flex items-center gap-2 text-sm text-gray-600">
                              <input
                                type="checkbox"
                                className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                              />
                              Caries Profunda
                            </label>
                            <label className="flex items-center gap-2 text-sm text-gray-600">
                              <input
                                type="checkbox"
                                className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                              />
                              Restauración
                            </label>
                          </div>

                          <div className="space-y-2 rounded-lg border border-gray-200 p-3">
                            <p className="text-sm font-bold text-gray-800">Raíz/Conducto</p>
                            <label className="flex items-center gap-2 text-sm text-gray-600">
                              <input
                                type="checkbox"
                                className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                              />
                              Conducto Curvo
                            </label>
                            <label className="flex items-center gap-2 text-sm text-gray-600">
                              <input
                                type="checkbox"
                                className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                              />
                              Calcificado
                            </label>
                          </div>

                          <div className="space-y-2 rounded-lg border border-gray-200 p-3">
                            <p className="text-sm font-bold text-gray-800">Región Periapical</p>
                            <label className="flex items-center gap-2 text-sm text-gray-600">
                              <input
                                type="checkbox"
                                className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                              />
                              Espacio LPD Normal
                            </label>
                            <label className="flex items-center gap-2 text-sm text-gray-600">
                              <input
                                type="checkbox"
                                className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                              />
                              Zona Radiolúcida
                            </label>
                          </div>
                        </div>

                        <div>
                          <label className="mb-1.5 block text-sm font-medium text-gray-800">
                            Otros Hallazgos
                          </label>
                          <input
                            type="text"
                            placeholder="Describa otros hallazgos radiográficos..."
                            className={inputClinico}
                          />
                        </div>
                      </div>
                    </section>
                  </div>
                  <div
                    className={pasoFormulario === 4 ? 'space-y-6' : 'hidden'}
                    data-formulario-paso="4"
                  >
                    <header className="space-y-1 text-center">
                      <h2 className="text-xl font-bold text-blue-900">
                        ANEXO ESPECIALIZADO: HISTORIA CLÍNICA DE ENDODONCIA
                      </h2>
                      <p className="text-sm text-gray-500">
                        Juicios diagnósticos, ficha técnica y control de evolución
                      </p>
                    </header>

                    {/* E4: Juicios Diagnósticos Definitivos */}
                    <section className="overflow-hidden rounded-md border border-gray-200">
                      <div className="bg-slate-700 p-2 text-sm font-bold text-white">
                        E4. JUICIOS DIAGNÓSTICOS DEFINITIVOS (AAE)
                      </div>
                      <div className="space-y-5 rounded-b-md border-t border-gray-200 bg-white p-4">
                        <div>
                          <p className="mb-3 text-sm font-bold text-gray-800">
                            Diagnóstico Pulpar
                          </p>
                          <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-3">
                            {DIAGNOSTICO_PULPAR_AAE.map((opcion) => (
                              <label
                                key={opcion}
                                className="flex items-start gap-2 rounded-md border border-gray-100 bg-gray-50/50 px-2 py-2 text-sm text-gray-700"
                              >
                                <input
                                  type="checkbox"
                                  className="mt-0.5 shrink-0 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                                />
                                <span>{opcion}</span>
                              </label>
                            ))}
                          </div>
                        </div>

                        <div>
                          <p className="mb-3 text-sm font-bold text-gray-800">
                            Diagnóstico Periapical
                          </p>
                          <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-3">
                            {DIAGNOSTICO_PERIAPICAL_AAE.map((opcion) => (
                              <label
                                key={opcion}
                                className="flex items-start gap-2 rounded-md border border-gray-100 bg-gray-50/50 px-2 py-2 text-sm text-gray-700"
                              >
                                <input
                                  type="checkbox"
                                  className="mt-0.5 shrink-0 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                                />
                                <span>{opcion}</span>
                              </label>
                            ))}
                          </div>
                        </div>
                      </div>
                    </section>

                    {/* E5: Datos del Procedimiento y Ficha Técnica */}
                    <section className="overflow-hidden rounded-md border border-gray-200">
                      <div className="bg-slate-700 p-2 text-sm font-bold text-white">
                        E5. DATOS DEL PROCEDIMIENTO Y FICHA TÉCNICA
                      </div>
                      <div className="space-y-6 rounded-b-md border-t border-gray-200 bg-white p-4">
                        <div>
                          <p className="mb-3 text-sm font-bold text-gray-800">
                            A. Preparación y Conductometría
                          </p>
                          <div className="overflow-x-auto rounded-md border border-gray-200">
                            <table className="w-full min-w-[720px] border-collapse text-left text-sm text-gray-700">
                              <thead>
                                <tr className="border-b border-gray-200 bg-gray-50">
                                  <th className="whitespace-nowrap border-r border-gray-200 px-3 py-2 text-xs font-semibold uppercase tracking-wide text-gray-600">
                                    Conducto
                                  </th>
                                  {COLUMNAS_CONDUCTOMETRIA.map((col) => (
                                    <th
                                      key={col}
                                      className="border-r border-gray-200 px-2 py-2 text-xs font-semibold uppercase tracking-wide text-gray-600 last:border-r-0"
                                    >
                                      {col}
                                    </th>
                                  ))}
                                </tr>
                              </thead>
                              <tbody>
                                {CONDUCTOS_FICHA_TECNICA.map((conducto) => (
                                  <tr
                                    key={conducto}
                                    className="border-b border-gray-200 last:border-b-0"
                                  >
                                    <td className="whitespace-nowrap border-r border-gray-200 bg-gray-50/80 px-3 py-1 text-xs font-semibold text-gray-800">
                                      {conducto}
                                    </td>
                                    {COLUMNAS_CONDUCTOMETRIA.map((col) => (
                                      <td
                                        key={`${conducto}-${col}`}
                                        className="border-r border-gray-200 p-0 last:border-r-0"
                                      >
                                        <input type="text" className={inputTabla} />
                                      </td>
                                    ))}
                                  </tr>
                                ))}
                              </tbody>
                            </table>
                          </div>
                        </div>

                        <div>
                          <p className="mb-3 text-sm font-bold text-gray-800">
                            B. Preparación Biomecánica y Obturación
                          </p>
                          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                            <div>
                              <label className="mb-1.5 block text-sm font-medium text-gray-700">
                                Técnica Prep
                              </label>
                              <select className={selectClinico} defaultValue="">
                                <option value="" disabled>
                                  Seleccionar...
                                </option>
                                <option>Manual</option>
                                <option>Rotatoria</option>
                                <option>Recíproca</option>
                              </select>
                            </div>
                            <div>
                              <label className="mb-1.5 block text-sm font-medium text-gray-700">
                                Irrigante
                              </label>
                              <select className={selectClinico} defaultValue="">
                                <option value="" disabled>
                                  Seleccionar...
                                </option>
                                <option>NaOCl %</option>
                                <option>Clorhexidina %</option>
                              </select>
                            </div>
                            <div>
                              <label className="mb-1.5 block text-sm font-medium text-gray-700">
                                Medicación Intra
                              </label>
                              <select className={selectClinico} defaultValue="">
                                <option value="" disabled>
                                  Seleccionar...
                                </option>
                                <option>Ca(OH)₂</option>
                                <option>Ninguna</option>
                                <option>Otra</option>
                              </select>
                            </div>
                            <div>
                              <label className="mb-1.5 block text-sm font-medium text-gray-700">
                                Técnica Obt
                              </label>
                              <select className={selectClinico} defaultValue="">
                                <option value="" disabled>
                                  Seleccionar...
                                </option>
                                <option>Condensación Lateral</option>
                                <option>Termoplástica</option>
                              </select>
                            </div>
                            <div>
                              <label className="mb-1.5 block text-sm font-medium text-gray-700">
                                Cemento Sellador
                              </label>
                              <select className={selectClinico} defaultValue="">
                                <option value="" disabled>
                                  Seleccionar...
                                </option>
                                <option>Base Resina</option>
                                <option>Óxido de Zinc</option>
                                <option>Biocerámico</option>
                              </select>
                            </div>
                            <div>
                              <label className="mb-1.5 block text-sm font-medium text-gray-700">
                                Restauración
                              </label>
                              <select className={selectClinico} defaultValue="">
                                <option value="" disabled>
                                  Seleccionar...
                                </option>
                                <option>Provisional</option>
                                <option>Definitiva Directa</option>
                                <option>Perno</option>
                              </select>
                            </div>
                          </div>
                        </div>
                      </div>
                    </section>

                    {/* Control de Citas y Evolución Clínica */}
                    <section className="overflow-hidden rounded-md border border-gray-200">
                      <div className="bg-slate-700 p-2 text-sm font-bold text-white">
                        CONTROL DE CITAS Y EVOLUCIÓN CLÍNICA
                      </div>
                      <div className="space-y-6 rounded-b-md border-t border-gray-200 bg-white p-4">
                        <div className="overflow-x-auto rounded-md border border-gray-200">
                          <table className="w-full min-w-[640px] border-collapse text-left text-sm text-gray-700">
                            <thead>
                              <tr className="border-b border-gray-200 bg-gray-50">
                                <th className="w-36 border-r border-gray-200 px-3 py-2 text-xs font-semibold uppercase tracking-wide text-gray-600">
                                  Fecha
                                </th>
                                <th className="border-r border-gray-200 px-3 py-2 text-xs font-semibold uppercase tracking-wide text-gray-600">
                                  Evolución Clínico-Procedimental / Medicación Prescrita
                                </th>
                                <th className="w-48 px-3 py-2 text-xs font-semibold uppercase tracking-wide text-gray-600">
                                  Firma Profesional
                                </th>
                              </tr>
                            </thead>
                            <tbody>
                              {evolucionesPrevias.map((evolucion, indice) => (
                                <tr
                                  key={evolucion.id ?? `evolucion-${indice}`}
                                  className="border-b border-gray-200 bg-gray-50/80"
                                >
                                  <td className="border-r border-gray-200 px-3 py-2 text-sm text-gray-700">
                                    {formatearFechaPostgres(
                                      evolucion.fecha_evolucion,
                                    )}
                                  </td>
                                  <td className="border-r border-gray-200 px-3 py-2 text-sm text-gray-700">
                                    {evolucion.evolucion_procedimiento || '—'}
                                  </td>
                                  <td className="px-3 py-2 text-sm text-gray-600">
                                    {evolucion.firma_profesional || '—'}
                                  </td>
                                </tr>
                              ))}

                              <tr className="border-b border-gray-200 bg-white">
                                <td className="border-r border-gray-200 p-0">
                                  <input
                                    type="date"
                                    value={evolucionCitaActual.fecha}
                                    onChange={(e) =>
                                      setEvolucionCitaActual((prev) => ({
                                        ...prev,
                                        fecha: e.target.value,
                                      }))
                                    }
                                    className={inputTabla}
                                  />
                                </td>
                                <td className="border-r border-gray-200 p-0">
                                  <input
                                    type="text"
                                    value={evolucionCitaActual.evolucionProcedimiento}
                                    onChange={(e) =>
                                      setEvolucionCitaActual((prev) => ({
                                        ...prev,
                                        evolucionProcedimiento: e.target.value,
                                      }))
                                    }
                                    placeholder="Procedimiento / medicación de la cita actual"
                                    className={inputTabla}
                                  />
                                </td>
                                <td className="p-0">
                                  <input
                                    type="text"
                                    value={evolucionCitaActual.firmaProfesional}
                                    onChange={(e) =>
                                      setEvolucionCitaActual((prev) => ({
                                        ...prev,
                                        firmaProfesional: e.target.value,
                                      }))
                                    }
                                    placeholder="Registro profesional"
                                    className={inputTabla}
                                  />
                                </td>
                              </tr>
                            </tbody>
                          </table>
                        </div>

                        <div className="grid grid-cols-1 gap-8 border-t border-gray-200 pt-6 md:grid-cols-2">
                          <div className="flex flex-col items-center">
                            <SignatureCanvas
                              ref={firmaOdontologoRef}
                              penColor="#1f2937"
                              canvasProps={{
                                width: 300,
                                height: 150,
                                className:
                                  'rounded border border-gray-300 bg-white touch-none',
                              }}
                            />
                            <button
                              type="button"
                              onClick={() => firmaOdontologoRef.current?.clear()}
                              className="mt-2 text-xs font-medium text-red-600 hover:text-red-700"
                            >
                              Limpiar firma
                            </button>
                            <p className="mt-2 text-center text-xs font-medium text-gray-700">
                              Firma del Odontólogo Tratante (Sello y Registro)
                            </p>
                          </div>
                          <div className="flex flex-col items-center">
                            <SignatureCanvas
                              ref={firmaPacienteRef}
                              penColor="#1f2937"
                              canvasProps={{
                                width: 300,
                                height: 150,
                                className:
                                  'rounded border border-gray-300 bg-white touch-none',
                              }}
                            />
                            <button
                              type="button"
                              onClick={() => firmaPacienteRef.current?.clear()}
                              className="mt-2 text-xs font-medium text-red-600 hover:text-red-700"
                            >
                              Limpiar firma
                            </button>
                            <p className="mt-2 text-center text-xs font-medium text-gray-700">
                              Firma del Paciente / Representante (Consentimiento
                              Informado)
                            </p>
                          </div>
                        </div>
                      </div>
                    </section>
                  </div>
                </div>
              </div>

              <div className="no-print flex items-center justify-between">
                <button
                  type="button"
                  onClick={cerrarFormularioConsulta}
                  className="rounded-lg border border-slate-200 bg-slate-100 px-4 py-2 text-sm font-medium text-slate-700 transition-colors hover:bg-slate-200"
                >
                  Cancelar
                </button>

                <div className="flex items-center gap-3">
                  {pasoFormulario > 1 && (
                    <button
                      type="button"
                      onClick={() => setPasoFormulario((paso) => paso - 1)}
                      className="rounded-lg border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-700 transition-colors hover:bg-slate-50"
                    >
                      Anterior
                    </button>
                  )}

                  {pasoFormulario < 4 && (
                    <button
                      type="button"
                      onClick={() => setPasoFormulario((paso) => paso + 1)}
                      className="rounded-lg bg-blue-800 px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-blue-900"
                    >
                      Siguiente
                    </button>
                  )}
                </div>
              </div>

              {pasoFormulario === 4 && (
                <div className="no-print mt-8 flex flex-col gap-3 sm:flex-row">
                  {esEdicionHistorica && (
                    <button
                      type="button"
                      onClick={imprimirInformeClinico}
                      className="flex flex-1 items-center justify-center rounded-lg border border-slate-300 bg-white px-6 py-3 text-base font-semibold text-slate-800 transition-colors hover:bg-slate-50"
                    >
                      Imprimir Informe
                    </button>
                  )}
                  <button
                    type="button"
                    disabled={guardandoHistoria}
                    onClick={guardarHistoriaYExportar}
                    className="flex flex-1 items-center justify-center gap-2 rounded-lg bg-blue-600 px-6 py-3 text-base font-bold text-white shadow-lg transition-colors hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-70"
                  >
                    {guardandoHistoria ? (
                      <>
                        <span
                          className="h-5 w-5 animate-spin rounded-full border-2 border-white/30 border-t-white"
                          aria-hidden="true"
                        />
                        Guardando...
                      </>
                    ) : esEdicionHistorica ? (
                      'Guardar Cambios'
                    ) : (
                      'Guardar Historia y Exportar a PDF'
                    )}
                  </button>
                </div>
              )}
            </section>
          ) : seccionActual === 'citas' ? (
            <ModuloCitas
              pacientes={pacientesRegistro}
              citas={citas}
              setCitas={setCitas}
              abrirModalInicial={abrirModalCitasDesdeDashboard}
              onModalInicialConsumido={() => setAbrirModalCitasDesdeDashboard(false)}
            />
          ) : seccionActual === 'reportes' ? (
            <ReportesEstadisticas
              pacientes={pacientesRegistro}
              citas={citas}
            />
          ) : seccionActual === 'finanzas' ? (
            <FinanzasProductividad
              pacientes={pacientesRegistro}
              cobros={cobros}
              onRecargarCobros={recargarCobros}
            />
          ) : null}
        </main>
      </div>
    </div>

      {modalExitoVisible && (
        <div
          className="fixed inset-0 z-[60] flex items-center justify-center bg-black bg-opacity-50 p-4"
          role="dialog"
          aria-modal="true"
          aria-labelledby="modal-exito-titulo"
        >
          <div className="w-full max-w-md rounded-2xl border border-slate-200 bg-white p-6 shadow-2xl">
            <h4
              id="modal-exito-titulo"
              className="text-lg font-bold text-emerald-800"
            >
              Operación Exitosa
            </h4>
            <p className="mt-3 text-sm text-slate-600">{mensajeExito}</p>
            <div className="mt-6 flex justify-end">
              <button
                type="button"
                onClick={() => setModalExitoVisible(false)}
                className="rounded-lg bg-blue-600 px-5 py-2 text-sm font-semibold text-white transition-colors hover:bg-blue-700"
              >
                Aceptar
              </button>
            </div>
          </div>
        </div>
      )}

      {modalEliminarVisible && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4"
          role="dialog"
          aria-modal="true"
          aria-labelledby="modal-eliminar-paciente-titulo"
        >
          <div className="w-full max-w-lg rounded-2xl border border-slate-200 bg-white shadow-2xl">
            <div className="border-b border-slate-100 px-6 py-4">
              <h4
                id="modal-eliminar-paciente-titulo"
                className="text-lg font-bold text-slate-900"
              >
                Eliminar paciente
              </h4>
              <p className="mt-1 text-sm text-slate-500">
                ¿Estás seguro de que deseas eliminar este paciente? Esta acción
                no se puede deshacer.
              </p>
            </div>

            <div className="flex flex-wrap justify-end gap-3 px-6 py-5">
              <button
                type="button"
                onClick={cerrarModalEliminar}
                disabled={eliminandoPaciente}
                className="rounded-lg border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-60"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={confirmarEliminacion}
                disabled={eliminandoPaciente}
                className="inline-flex items-center gap-2 rounded-lg bg-red-600 px-4 py-2 text-sm font-semibold text-white hover:bg-red-700 disabled:cursor-not-allowed disabled:opacity-70"
              >
                {eliminandoPaciente ? 'Eliminando…' : 'Eliminar'}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}

export default App
