import { initializeApp } from 'https://www.gstatic.com/firebasejs/10.12.5/firebase-app.js'
import { getFirestore } from 'https://www.gstatic.com/firebasejs/10.12.5/firebase-firestore.js'
import { getStorage } from 'https://www.gstatic.com/firebasejs/10.12.5/firebase-storage.js'

const firebaseConfig = {
  apiKey: "AIzaSyCv0TgA3_jFcC0fthmxyqxzg1phdXeMzkA",
  authDomain: "chase-x-records.firebaseapp.com",
  projectId: "chase-x-records",
  storageBucket: "chase-x-records.firebasestorage.app",
  messagingSenderId: "664068376824",
  appId: "1:664068376824:web:6a76a733327d709ff9d30d"
}

export const firebaseApp = initializeApp(firebaseConfig)
export const db = getFirestore(firebaseApp)
export const storage = getStorage(firebaseApp)
