// O SweetAlert2 (JS + CSS) só é baixado no primeiro alerta, fora do pacote de entrada.
let swal = null
const carregar = () =>
  (swal ??= Promise.all([import('sweetalert2'), import('sweetalert2/dist/sweetalert2.min.css')]).then(
    ([modulo]) => modulo.default,
    // Se o download falhar (ex.: sem internet), esquece a promessa para tentar de novo no próximo alerta.
    erro => {
      swal = null
      throw erro
    },
  ))

const baseOptions = {
  buttonsStyling: false,
  customClass: {
    confirmButton: 'btn btn-primary mx-1',
    cancelButton: 'btn btn-g mx-1',
    denyButton: 'btn btn-g mx-1',
    popup: 'konvex-alert',
  },
}

const show = async options => (await carregar()).fire({ ...baseOptions, ...options })

/**
 * Alertas do sistema (SweetAlert2 com os botões do Bootstrap). Todos devolvem Promise.
 * Erro de API na tela: `alerts.error('Não foi possível salvar', error.message)`.
 * `confirm` resolve true/false; `danger: true` para excluir ou encerrar (ícone de aviso e botão vermelho).
 * `toastSuccess` é o aviso discreto no canto, que some sozinho.
 */
const alerts = {
  success: (title, text = '') => show({ icon: 'success', title, text, confirmButtonText: 'Continuar' }),
  error: (title = 'Não foi possível concluir', text = 'Tente novamente.') =>
    show({ icon: 'error', title, text, confirmButtonText: 'Entendi' }),
  info: (title, text = '') => show({ icon: 'info', title, text, confirmButtonText: 'Entendi' }),
  confirm: async ({
    title = 'Confirmar ação?',
    text = 'Esta operação não poderá ser desfeita.',
    confirmText = 'Confirmar',
    cancelText = 'Cancelar',
    danger = false,
  } = {}) => {
    const result = await show({
      icon: danger ? 'warning' : 'question',
      title,
      text,
      showCancelButton: true,
      confirmButtonText: confirmText,
      cancelButtonText: cancelText,
      // Cancelar à esquerda, Confirmar à direita.
      reverseButtons: true,
      ...(danger ? { confirmButtonColor: '#b42318' } : {}),
    })
    return result.isConfirmed
  },
  toastSuccess: (title, text = '') =>
    show({ toast: true, position: 'top-end', icon: 'success', title, text, showConfirmButton: false, timer: 2400, timerProgressBar: true }),
  // Só fecha se o SweetAlert já foi baixado; não baixa nada só para fechar.
  close: () => {
    swal?.then(Swal => Swal.close())
  },
}

export default alerts
