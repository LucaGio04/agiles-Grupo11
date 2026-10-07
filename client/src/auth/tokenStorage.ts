const TOKEN_KEY = 'truequeutn.token';

// El token se guarda en localStorage para que la sesión sobreviva a una recarga de la página.
// localStorage puede no estar disponible (modo privado, almacenamiento bloqueado): en ese caso
// la sesión dura solo mientras la pestaña esté abierta.
export const tokenStorage = {
  get() {
    try {
      return localStorage.getItem(TOKEN_KEY);
    } catch {
      return null;
    }
  },
  set(token: string) {
    try {
      localStorage.setItem(TOKEN_KEY, token);
    } catch {
      // Sin almacenamiento disponible: se ignora.
    }
  },
  clear() {
    try {
      localStorage.removeItem(TOKEN_KEY);
    } catch {
      // Sin almacenamiento disponible: se ignora.
    }
  },
};
