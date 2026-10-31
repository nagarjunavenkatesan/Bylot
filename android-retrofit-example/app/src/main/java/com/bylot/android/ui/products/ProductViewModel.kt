package com.bylot.android.ui.products

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.bylot.android.data.model.Product
import com.bylot.android.data.repository.ApiResult
import com.bylot.android.data.repository.ProductRepository
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.launch

data class ProductUiState(
    val isLoading: Boolean = false,
    val products: List<Product> = emptyList(),
    val errorMessage: String? = null,
    val successMessage: String? = null
)

class ProductViewModel(
    private val repository: ProductRepository = ProductRepository()
) : ViewModel() {

    private val _uiState = MutableStateFlow(ProductUiState(isLoading = true))
    val uiState: StateFlow<ProductUiState> = _uiState.asStateFlow()

    init {
        loadProducts()
    }

    fun loadProducts() {
        viewModelScope.launch {
            _uiState.value = _uiState.value.copy(
                isLoading = true,
                errorMessage = null,
                successMessage = null
            )

            when (val result = repository.fetchProducts()) {
                is ApiResult.Success -> {
                    _uiState.value = ProductUiState(
                        isLoading = false,
                        products = result.data
                    )
                }

                is ApiResult.Error -> {
                    _uiState.value = ProductUiState(
                        isLoading = false,
                        products = emptyList(),
                        errorMessage = result.message
                    )
                }
            }
        }
    }

    fun deleteProduct(id: Long, onComplete: ((Boolean, String?) -> Unit)? = null) {
        viewModelScope.launch {
            when (val result = repository.deleteProduct(id)) {
                is ApiResult.Success -> {
                    _uiState.value = _uiState.value.copy(
                        products = _uiState.value.products.filterNot { it.id == id },
                        successMessage = "Item deleted successfully."
                    )
                    onComplete?.invoke(true, "Item deleted successfully.")
                }

                is ApiResult.Error -> {
                    _uiState.value = _uiState.value.copy(
                        errorMessage = result.message
                    )
                    onComplete?.invoke(false, result.message)
                }
            }
        }
    }

    fun clearMessages() {
        _uiState.value = _uiState.value.copy(
            errorMessage = null,
            successMessage = null
        )
    }
}
