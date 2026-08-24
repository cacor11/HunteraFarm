'use strict'

const { contextBridge, ipcRenderer } = require('electron')

const IPC_SUPPORT_COMMAND = 'hunterafarm:support-command'

contextBridge.exposeInMainWorld('hunteraFarmSupport', {
  copyPix() {
    return ipcRenderer.invoke(IPC_SUPPORT_COMMAND, { command: 'copy-pix' })
  },
  close() {
    return ipcRenderer.invoke(IPC_SUPPORT_COMMAND, { command: 'close' })
  }
})
