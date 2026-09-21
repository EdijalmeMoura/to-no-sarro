import { useEffect } from "react";

export function useKeyboardShortcuts({ store, goRole }) {
  useEffect(() => {
    const handler = (e) => {
      // Ignora se estiver digitando em input
      if (e.target.tagName === "INPUT" || e.target.tagName === "TEXTAREA" || e.target.isContentEditable) return;
      
      if (e.ctrlKey || e.metaKey) {
        if (e.key.toLowerCase() === "k") {
          e.preventDefault();
          // Busca produto - foca no input de busca se existir
          const searchInput = document.querySelector('input[placeholder*="Buscar"], input[placeholder*="buscar"]');
          if (searchInput) searchInput.focus();
        }
      }
      
      // Atalhos sem Ctrl
      if (!e.ctrlKey && !e.metaKey && !e.altKey) {
        if (e.key.toLowerCase() === "n" && store.role === "admin") {
          // Novo pedido - vai para cardápio
          // store.setTab("cardapio") se existir
        }
        if (e.key.toLowerCase() === "m") {
          // Mesas
          if (store.settings?.tablesEnabled) {
            goRole?.("mesas");
          }
        }
        if (e.key.toLowerCase() === "e") {
          goRole?.("expedicao");
        }
        if (e.key.toLowerCase() === "c") {
          goRole?.("cozinha");
        }
        if (e.key === "?") {
          // Mostra ajuda de atalhos
          alert(`Atalhos:\nCtrl+K - Buscar produto\nM - Mesas/Salão\nE - Expedição\nC - Cozinha\n? - Esta ajuda`);
        }
      }
    };

    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [store, goRole]);
}
