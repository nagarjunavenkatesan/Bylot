package com.bylot.android.data.repository

import com.bylot.android.data.model.Product
import com.bylot.android.data.model.toDomain
import com.bylot.android.data.remote.ApiService
import com.bylot.android.data.remote.RetrofitClient
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext
import java.io.IOException

sealed interface ApiResult<out T> {
    data class Success<T>(val data: T) : ApiResult<T>
    data class Error(val message: String, val throwable: Throwable? = null) : ApiResult<Nothing>
}

class ProductRepository(
    private val apiService: ApiService = RetrofitClient.apiService
) {
    suspend fun fetchProducts(): ApiResult<List<Product>> = withContext(Dispatchers.IO) {
        try {
            val response = apiService.getProducts()

            if (response.isSuccessful) {
                val products = response.body()
                    ?.map { it.toDomain(RetrofitClient.BASE_URL) }
                    .orEmpty()

                ApiResult.Success(products)
            } else {
                ApiResult.Error("Server error ${response.code()}: ${response.message()}")
            }
        } catch (exception: IOException) {
            ApiResult.Error(
                message = "Cannot connect to backend. Check WiFi, IP address, backend port, and firewall.",
                throwable = exception
            )
        } catch (exception: Exception) {
            ApiResult.Error(
                message = exception.message ?: "Unexpected error while loading products.",
                throwable = exception
            )
        }
    }
}
