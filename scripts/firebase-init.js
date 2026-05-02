import { initializeApp } from 'https://www.gstatic.com/firebasejs/10.12.5/firebase-app.js'
import { getFirestore } from 'https://www.gstatic.com/firebasejs/10.12.5/firebase-firestore.js'
import { getStorage } from 'https://www.gstatic.com/firebasejs/10.12.5/firebase-storage.js'
import { getAuth, browserLocalPersistence, setPersistence } from 'https://www.gstatic.com/firebasejs/10.12.5/firebase-auth.js'
import { getFunctions } from 'https://www.gstatic.com/firebasejs/10.12.5/firebase-functions.js'

const firebaseConfig = {
  apiKey: "AIzaSyCv0TgA3_jFcC0fthmxyqxzg1phdXeMzkA",
  authDomain: "chase-x-records.firebaseapp.com",
  projectId: "chase-x-records",
  storageBucket: "chase-x-records.appspot.com",
  messagingSenderId: "664068376824",
  appId: "1:664068376824:web:6a76a733327d709ff9d30d"
}

export const firebaseApp = initializeApp(firebaseConfig)
export const db = getFirestore(firebaseApp)
export const storage = getStorage(firebaseApp)
export const auth = getAuth(firebaseApp)
export const functions = getFunctions(firebaseApp)

// Set auth persistence to LOCAL to keep users logged in across browser sessions
setPersistence(auth, browserLocalPersistence).catch((error) => {
  console.error('Error setting auth persistence:', error)
})
