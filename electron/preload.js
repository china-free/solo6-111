import { contextBridge, ipcRenderer } from 'electron';

contextBridge.exposeInMainWorld('electronAPI', {
  database: {
    getInvoices: (params) => ipcRenderer.invoke('db:getInvoices', params),
    getInvoiceById: (id) => ipcRenderer.invoke('db:getInvoiceById', id),
    addInvoice: (invoice) => ipcRenderer.invoke('db:addInvoice', invoice),
    updateInvoice: (id, invoice) => ipcRenderer.invoke('db:updateInvoice', id, invoice),
    deleteInvoice: (id) => ipcRenderer.invoke('db:deleteInvoice', id),
    getInvoiceByFileHash: (hash) => ipcRenderer.invoke('db:getInvoiceByFileHash', hash),
    
    getTransactions: (params) => ipcRenderer.invoke('db:getTransactions', params),
    getTransactionById: (id) => ipcRenderer.invoke('db:getTransactionById', id),
    addTransaction: (transaction) => ipcRenderer.invoke('db:addTransaction', transaction),
    addTransactions: (transactions) => ipcRenderer.invoke('db:addTransactions', transactions),
    updateTransaction: (id, transaction) => ipcRenderer.invoke('db:updateTransaction', id, transaction),
    deleteTransaction: (id) => ipcRenderer.invoke('db:deleteTransaction', id),
    
    getMatches: (params) => ipcRenderer.invoke('db:getMatches', params),
    getMatchById: (id) => ipcRenderer.invoke('db:getMatchById', id),
    addMatch: (match) => ipcRenderer.invoke('db:addMatch', match),
    updateMatch: (id, match) => ipcRenderer.invoke('db:updateMatch', id, match),
    deleteMatch: (id) => ipcRenderer.invoke('db:deleteMatch', id),
    getMatchesByInvoiceId: (invoiceId) => ipcRenderer.invoke('db:getMatchesByInvoiceId', invoiceId),
    getMatchesByTransactionId: (transactionId) => ipcRenderer.invoke('db:getMatchesByTransactionId', transactionId),
    
    getAnomalies: (params) => ipcRenderer.invoke('db:getAnomalies', params),
    addAnomaly: (anomaly) => ipcRenderer.invoke('db:addAnomaly', anomaly),
    updateAnomaly: (id, anomaly) => ipcRenderer.invoke('db:updateAnomaly', id, anomaly),
    resolveAnomaly: (id, resolution) => ipcRenderer.invoke('db:resolveAnomaly', id, resolution),
    
    getStats: () => ipcRenderer.invoke('db:getStats'),
  },
  
  ocr: {
    recognizeFile: (filePath) => ipcRenderer.invoke('ocr:recognizeFile', filePath),
    recognizeFiles: (filePaths) => ipcRenderer.invoke('ocr:recognizeFiles', filePaths),
    parseInvoiceFields: (text) => ipcRenderer.invoke('ocr:parseInvoiceFields', text),
  },
  
  import: {
    importInvoiceFiles: (filePaths) => ipcRenderer.invoke('import:invoiceFiles', filePaths),
    importTransactions: (filePath) => ipcRenderer.invoke('import:transactions', filePath),
  },
  
  match: {
    autoMatch: () => ipcRenderer.invoke('match:auto'),
    getMatchCandidates: (type, id) => ipcRenderer.invoke('match:candidates', type, id),
    manualMatch: (invoiceId, transactionId, amount) => ipcRenderer.invoke('match:manual', invoiceId, transactionId, amount),
    unmatch: (matchId) => ipcRenderer.invoke('match:unmatch', matchId),
  },
  
  export: {
    exportReconciliation: (filePath, options) => ipcRenderer.invoke('export:reconciliation', filePath, options),
  },
  
  dialog: {
    openFiles: (options) => ipcRenderer.invoke('dialog:openFiles', options),
    openDirectory: (options) => ipcRenderer.invoke('dialog:openDirectory', options),
    saveFile: (options) => ipcRenderer.invoke('dialog:saveFile', options),
  },
});
