package com.example.data.remote

import com.google.firebase.auth.FirebaseAuth
import com.google.firebase.firestore.FirebaseFirestoreException
import kotlinx.coroutines.CancellationException
import kotlinx.coroutines.delay
import kotlinx.coroutines.flow.Flow
import kotlinx.coroutines.flow.catch
import kotlinx.coroutines.flow.retryWhen

/**
 * Keeps a Firestore snapshot listener alive across transient failures (token race, network,
 * rules propagation) instead of emitting a fallback and completing forever.
 *
 * - Retries with exponential backoff (2s .. 60s).
 * - Optionally emits [fallback] once, on the first failure only.
 * - Stops quietly (completes without error) when the signed-in user changed or signed out.
 */
fun <T> Flow<T>.retryFirestoreListener(
    auth: FirebaseAuth?,
    uid: String?,
    operation: OperationType,
    path: String,
    fallback: (() -> T)? = null
): Flow<T> = retryWhen { cause, attempt ->
    val firestoreError = generateSequence(cause) { it.cause }
        .filterIsInstance<FirebaseFirestoreException>()
        .firstOrNull()
    if (firestoreError == null && cause is CancellationException) return@retryWhen false
    if (uid != null && auth != null && auth.currentUser?.uid != uid) return@retryWhen false
    if (attempt == 0L || attempt % 10L == 0L) {
        handleFirestoreError(firestoreError ?: cause, operation, path)
    }
    if (attempt == 0L && fallback != null) emit(fallback())
    val backoffMs = (2_000L shl attempt.coerceAtMost(5L).toInt()).coerceAtMost(60_000L)
    delay(backoffMs)
    true
}.catch { e ->
    // Reached only when retrying stopped (sign-out / user switch / cancellation).
    if (e is CancellationException && e !is FirebaseFirestoreException) throw e
}
