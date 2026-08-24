'use strict'

const { contextBridge, ipcRenderer } = require('electron')

const IPC_COMMAND = 'hunterafarm:command'
const IPC_GET_STATE = 'hunterafarm:get-state'
const IPC_STATE = 'hunterafarm:state'

contextBridge.exposeInMainWorld('hunteraFarm', {
  platform: process.platform,
  command(request) {
    return ipcRenderer.invoke(IPC_COMMAND, request)
  },
  getState() {
    return ipcRenderer.invoke(IPC_GET_STATE)
  },
  onState(callback) {
    const listener = (_event, state) => callback(state)
    ipcRenderer.on(IPC_STATE, listener)
    return () => ipcRenderer.removeListener(IPC_STATE, listener)
  }
})
