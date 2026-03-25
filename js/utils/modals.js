// Inject SweetAlert2 dynamically
if (!document.getElementById('sweetalert-script')) {
    const script = document.createElement('script');
    script.id = 'sweetalert-script';
    script.src = 'https://cdn.jsdelivr.net/npm/sweetalert2@11';
    document.head.appendChild(script);
}

const waitForSwal = async () => {
    while(typeof window.Swal === 'undefined') {
        await new Promise(r => setTimeout(r, 50));
    }
};

export const showPrompt = async (title, label, defaultValue = "", inputType = "text") => {
    await waitForSwal();
    const config = {
        title: title,
        input: inputType,
        inputLabel: label,
        inputValue: defaultValue,
        background: '#161622',
        color: '#fff',
        confirmButtonColor: '#7c3aed',
        cancelButtonColor: '#ffffff10',
        showCancelButton: true,
        cancelButtonText: 'Cancelar',
        confirmButtonText: 'Aceptar',
        customClass: {
            popup: 'border border-white/10 rounded-2xl shadow-2xl',
            input: 'border border-white/10 bg-[#0a0a0f] text-white rounded-lg focus:border-[#7c3aed] focus:ring-1 focus:ring-[#7c3aed]',
            confirmButton: 'bg-gradient-to-r from-[#7c3aed] to-[#6d28d9] hover:brightness-110 shadow-[0_0_15px_rgba(124,58,237,0.3)] border-none rounded-xl px-6',
            cancelButton: 'bg-white/5 hover:bg-white/10 text-gray-400 border border-white/10 rounded-xl px-6'
        }
    };
    if (inputType === 'number') {
        config.inputAttributes = {
            step: 'any'
        };
    }
    const { value } = await window.Swal.fire(config);
    return value;
};

export const showConfirm = async (title, text) => {
    await waitForSwal();
    const { isConfirmed } = await window.Swal.fire({
        title: title,
        text: text,
        background: '#161622',
        color: '#fff',
        icon: 'warning',
        iconColor: '#f87171',
        confirmButtonColor: '#f87171',
        cancelButtonColor: '#ffffff10',
        showCancelButton: true,
        cancelButtonText: 'Cancelar',
        confirmButtonText: 'Sí, confirmar',
        customClass: {
            popup: 'border border-white/10 rounded-2xl shadow-2xl',
            confirmButton: 'bg-red-500 hover:bg-red-600 border-none rounded-xl px-6 shadow-lg shadow-red-500/20 text-white',
            cancelButton: 'bg-white/5 hover:bg-white/10 text-gray-400 border border-white/10 rounded-xl px-6'
        }
    });
    return isConfirmed;
};

export const showAlert = async (title, text, type = 'success') => {
    await waitForSwal();
    let iconColor = type === 'success' ? '#4ade80' : '#f87171';
    if(type === 'info') iconColor = '#a78bfa';
    
    await window.Swal.fire({
        title: title,
        text: text,
        icon: type,
        iconColor: iconColor,
        background: '#161622',
        color: '#fff',
        confirmButtonColor: '#7c3aed',
        timer: type === 'success' ? 2500 : undefined,
        customClass: {
            popup: 'border border-white/10 rounded-2xl shadow-2xl',
            confirmButton: 'bg-gradient-to-r from-[#7c3aed] to-[#6d28d9] hover:brightness-110 shadow-[0_0_15px_rgba(124,58,237,0.3)] border-none rounded-xl px-6',
        }
    });
};
