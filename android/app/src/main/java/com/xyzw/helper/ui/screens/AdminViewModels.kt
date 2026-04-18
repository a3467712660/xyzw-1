package com.xyzw.helper.ui.screens

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.xyzw.helper.data.model.ActivationCodeItem
import com.xyzw.helper.data.model.AdminActionError
import com.xyzw.helper.data.model.AdminConfirmCredential
import com.xyzw.helper.data.model.AdminConfirmToken
import com.xyzw.helper.data.model.AdminMfaResetLinkPayload
import com.xyzw.helper.data.model.AdminPasswordResetCodePayload
import com.xyzw.helper.data.model.AdminTaskControlLogItem
import com.xyzw.helper.data.model.AdminUserItem
import com.xyzw.helper.data.model.AdminUserTokenActivationsPayload
import com.xyzw.helper.data.model.FeedbackItem
import com.xyzw.helper.data.model.InviteCodeItem
import com.xyzw.helper.data.model.ReferralAttributionItem
import com.xyzw.helper.data.model.ReferralConversionItem
import com.xyzw.helper.data.model.WechatContactAdminItem
import com.xyzw.helper.data.network.AdminChangelogBroadcastRequest
import com.xyzw.helper.data.network.AdminWechatContactRequest
import com.xyzw.helper.data.network.ApiResult
import com.xyzw.helper.data.repository.AdminFeedbackRepository
import com.xyzw.helper.data.repository.AdminRepository
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.launch

data class AdminUsersUiState(
  val users: List<AdminUserItem> = emptyList(),
  val tokenActivations: AdminUserTokenActivationsPayload? = null,
  val isLoading: Boolean = true,
  val isTokenActivationsLoading: Boolean = false,
  val error: AdminActionError? = null,
)

class AdminUsersViewModel(
  private val repository: AdminRepository,
) : ViewModel() {
  private val mutableState = MutableStateFlow(AdminUsersUiState())
  val uiState: StateFlow<AdminUsersUiState> = mutableState.asStateFlow()

  init {
    viewModelScope.launch { refresh() }
  }

  suspend fun refresh() {
    mutableState.value = mutableState.value.copy(isLoading = true, error = null)
    when (val result = repository.listUsers()) {
      is ApiResult.Success -> {
        mutableState.value = mutableState.value.copy(
          users = result.data,
          isLoading = false,
          error = null,
        )
      }

      is ApiResult.Failure -> {
        mutableState.value = mutableState.value.copy(
          isLoading = false,
          error = result.error.toAdminActionError(),
        )
      }
    }
  }

  suspend fun loadTokenActivations(userId: String): ApiResult<AdminUserTokenActivationsPayload> {
    mutableState.value = mutableState.value.copy(isTokenActivationsLoading = true, error = null)
    return when (val result = repository.listUserTokenActivations(userId)) {
      is ApiResult.Success -> {
        mutableState.value = mutableState.value.copy(
          tokenActivations = result.data,
          isTokenActivationsLoading = false,
          error = null,
        )
        result
      }

      is ApiResult.Failure -> {
        mutableState.value = mutableState.value.copy(
          isTokenActivationsLoading = false,
          error = result.error.toAdminActionError(),
        )
        result
      }
    }
  }

  suspend fun confirmSensitiveAction(
    credential: AdminConfirmCredential,
  ): ApiResult<AdminConfirmToken> =
    repository.confirmSensitiveAction(credential)

  suspend fun updateUserAdmin(id: String, isAdmin: Boolean): ApiResult<Unit> =
    runMutation { repository.updateUserAdmin(id, isAdmin) }

  suspend fun updateUserAccessScope(id: String, accessScope: String): ApiResult<Unit> =
    runMutation { repository.updateUserAccessScope(id, accessScope) }

  suspend fun updateUserTokenBindLimit(id: String, tokenBindLimit: Int): ApiResult<Unit> =
    runMutation { repository.updateUserTokenBindLimit(id, tokenBindLimit) }

  suspend fun resetUserPassword(id: String, password: String): ApiResult<Unit> =
    runMutation { repository.resetUserPassword(id, password) }

  suspend fun createPasswordResetCode(
    id: String,
    expiresInMinutes: Int = 15,
  ): ApiResult<AdminPasswordResetCodePayload> =
    runMutation(refreshAfterSuccess = false) {
      repository.createPasswordResetCode(id, expiresInMinutes)
    }

  suspend fun createMfaResetLink(id: String): ApiResult<AdminMfaResetLinkPayload> =
    runMutation(refreshAfterSuccess = false) {
      repository.createMfaResetLink(id)
    }

  suspend fun revokeSessions(id: String): ApiResult<Unit> =
    runMutation { repository.revokeSessions(id) }

  suspend fun deleteUser(id: String): ApiResult<Unit> =
    runMutation { repository.deleteUser(id) }

  private suspend fun <T> runMutation(
    refreshAfterSuccess: Boolean = true,
    block: suspend () -> ApiResult<T>,
  ): ApiResult<T> =
    when (val result = block()) {
      is ApiResult.Success -> {
        if (refreshAfterSuccess) {
          refresh()
        } else {
          mutableState.value = mutableState.value.copy(error = null)
        }
        result
      }

      is ApiResult.Failure -> {
        mutableState.value = mutableState.value.copy(error = result.error.toAdminActionError())
        result
      }
    }
}

data class AdminInvitesUiState(
  val invites: List<InviteCodeItem> = emptyList(),
  val isLoading: Boolean = true,
  val error: AdminActionError? = null,
)

class AdminInvitesViewModel(
  private val repository: AdminRepository,
) : ViewModel() {
  private val mutableState = MutableStateFlow(AdminInvitesUiState())
  val uiState: StateFlow<AdminInvitesUiState> = mutableState.asStateFlow()

  init {
    viewModelScope.launch { refresh() }
  }

  suspend fun refresh() {
    mutableState.value = mutableState.value.copy(isLoading = true, error = null)
    when (val result = repository.listInviteCodes()) {
      is ApiResult.Success -> {
        mutableState.value = mutableState.value.copy(
          invites = result.data,
          isLoading = false,
          error = null,
        )
      }

      is ApiResult.Failure -> {
        mutableState.value = mutableState.value.copy(
          isLoading = false,
          error = result.error.toAdminActionError(),
        )
      }
    }
  }

  suspend fun confirmSensitiveAction(credential: AdminConfirmCredential): ApiResult<AdminConfirmToken> =
    repository.confirmSensitiveAction(credential)

  suspend fun createInvites(
    count: Int,
    isTemporary: Boolean,
    bindAccountLimit: Int,
    featureScope: String = "full",
  ): ApiResult<List<InviteCodeItem>> =
    runMutation {
      repository.createInviteCodes(
        count = count,
        isTemporary = isTemporary,
        bindAccountLimit = bindAccountLimit,
        featureScope = featureScope,
      )
    }

  suspend fun disableInvite(id: String): ApiResult<Unit> =
    runMutation { repository.disableInviteCode(id) }

  private suspend fun <T> runMutation(
    block: suspend () -> ApiResult<T>,
  ): ApiResult<T> =
    when (val result = block()) {
      is ApiResult.Success -> {
        refresh()
        result
      }

      is ApiResult.Failure -> {
        mutableState.value = mutableState.value.copy(error = result.error.toAdminActionError())
        result
      }
    }
}

data class AdminActivationCodesUiState(
  val activationCodes: List<ActivationCodeItem> = emptyList(),
  val isLoading: Boolean = true,
  val error: AdminActionError? = null,
)

class AdminActivationCodesViewModel(
  private val repository: AdminRepository,
) : ViewModel() {
  private val mutableState = MutableStateFlow(AdminActivationCodesUiState())
  val uiState: StateFlow<AdminActivationCodesUiState> = mutableState.asStateFlow()

  init {
    viewModelScope.launch { refresh() }
  }

  suspend fun refresh() {
    mutableState.value = mutableState.value.copy(isLoading = true, error = null)
    when (val result = repository.listActivationCodes()) {
      is ApiResult.Success -> {
        mutableState.value = mutableState.value.copy(
          activationCodes = result.data,
          isLoading = false,
          error = null,
        )
      }

      is ApiResult.Failure -> {
        mutableState.value = mutableState.value.copy(
          isLoading = false,
          error = result.error.toAdminActionError(),
        )
      }
    }
  }

  suspend fun confirmSensitiveAction(credential: AdminConfirmCredential): ApiResult<AdminConfirmToken> =
    repository.confirmSensitiveAction(credential)

  suspend fun createActivationCodes(
    count: Int,
    featureScope: String,
    durationMonths: Int,
    saleAmountCents: Int,
  ): ApiResult<List<ActivationCodeItem>> =
    runMutation {
      repository.createActivationCodes(
        count = count,
        featureScope = featureScope,
        durationMonths = durationMonths,
        saleAmountCents = saleAmountCents,
      )
    }

  suspend fun unbindActivationCode(id: String): ApiResult<Unit> =
    runMutation { repository.unbindActivationCode(id) }

  suspend fun unbindAllActivationCodes(): ApiResult<Unit> =
    runMutation { repository.unbindAllActivationCodes() }

  suspend fun disableActivationCode(id: String): ApiResult<Unit> =
    runMutation { repository.disableActivationCode(id) }

  suspend fun deleteActivationCode(id: String): ApiResult<Unit> =
    runMutation { repository.deleteActivationCode(id) }

  private suspend fun <T> runMutation(
    block: suspend () -> ApiResult<T>,
  ): ApiResult<T> =
    when (val result = block()) {
      is ApiResult.Success -> {
        refresh()
        result
      }

      is ApiResult.Failure -> {
        mutableState.value = mutableState.value.copy(error = result.error.toAdminActionError())
        result
      }
    }
}

data class AdminFeedbackTicketsUiState(
  val feedbacks: List<FeedbackItem> = emptyList(),
  val currentStatus: String = "",
  val isLoading: Boolean = true,
  val error: AdminActionError? = null,
)

class AdminFeedbackTicketsViewModel(
  private val feedbackRepository: AdminFeedbackRepository,
) : ViewModel() {
  private val mutableState = MutableStateFlow(AdminFeedbackTicketsUiState())
  val uiState: StateFlow<AdminFeedbackTicketsUiState> = mutableState.asStateFlow()

  init {
    viewModelScope.launch { refresh() }
  }

  suspend fun refresh(status: String = mutableState.value.currentStatus) {
    mutableState.value = mutableState.value.copy(isLoading = true, currentStatus = status, error = null)
    when (val result = feedbackRepository.listFeedbacks(status.ifBlank { null })) {
      is ApiResult.Success -> {
        mutableState.value = mutableState.value.copy(
          feedbacks = result.data,
          isLoading = false,
          error = null,
        )
      }

      is ApiResult.Failure -> {
        mutableState.value = mutableState.value.copy(
          isLoading = false,
          error = result.error.toAdminActionError(),
        )
      }
    }
  }

  suspend fun updateTicket(
    id: String,
    status: String,
    adminNote: String,
  ): ApiResult<FeedbackItem> =
    when (val result = feedbackRepository.updateTicket(id, status, adminNote)) {
      is ApiResult.Success -> {
        refresh(mutableState.value.currentStatus)
        result
      }

      is ApiResult.Failure -> {
        mutableState.value = mutableState.value.copy(error = result.error.toAdminActionError())
        result
      }
    }
}

data class AdminTaskControlLogsUiState(
  val logs: List<AdminTaskControlLogItem> = emptyList(),
  val filters: AdminTaskControlLogFilters = AdminTaskControlLogFilters(),
  val isLoading: Boolean = true,
  val error: AdminActionError? = null,
)

class AdminTaskControlLogsViewModel(
  private val repository: AdminRepository,
) : ViewModel() {
  private val mutableState = MutableStateFlow(AdminTaskControlLogsUiState())
  val uiState: StateFlow<AdminTaskControlLogsUiState> = mutableState.asStateFlow()

  init {
    viewModelScope.launch { refresh() }
  }

  suspend fun refresh(filters: AdminTaskControlLogFilters = mutableState.value.filters) {
    val query = filters.toQuery()
    mutableState.value = mutableState.value.copy(
      isLoading = true,
      filters = filters.copy(limit = query.limit),
      error = null,
    )
    when (val result = repository.listTaskControlLogs(query)) {
      is ApiResult.Success -> {
        mutableState.value = mutableState.value.copy(
          logs = result.data,
          isLoading = false,
          error = null,
        )
      }

      is ApiResult.Failure -> {
        mutableState.value = mutableState.value.copy(
          isLoading = false,
          error = result.error.toAdminActionError(),
        )
      }
    }
  }
}

data class AdminChangelogBroadcastUiState(
  val isSending: Boolean = false,
  val error: AdminActionError? = null,
)

class AdminChangelogBroadcastViewModel(
  private val repository: AdminRepository,
) : ViewModel() {
  private val mutableState = MutableStateFlow(AdminChangelogBroadcastUiState())
  val uiState: StateFlow<AdminChangelogBroadcastUiState> = mutableState.asStateFlow()

  suspend fun send(
    version: String,
    title: String,
    content: String,
    path: String = "/changelog",
  ): ApiResult<com.xyzw.helper.data.network.AdminChangelogBroadcastResult> {
    mutableState.value = mutableState.value.copy(isSending = true, error = null)
    return when (val result = repository.sendChangelogBroadcast(version, title, content, path)) {
      is ApiResult.Success -> {
        mutableState.value = mutableState.value.copy(isSending = false, error = null)
        result
      }

      is ApiResult.Failure -> {
        mutableState.value = mutableState.value.copy(
          isSending = false,
          error = result.error.toAdminActionError(),
        )
        result
      }
    }
  }
}

data class AdminWechatContactsUiState(
  val contacts: List<WechatContactAdminItem> = emptyList(),
  val isLoading: Boolean = true,
  val error: AdminActionError? = null,
)

class AdminWechatContactsViewModel(
  private val repository: AdminRepository,
) : ViewModel() {
  private val mutableState = MutableStateFlow(AdminWechatContactsUiState())
  val uiState: StateFlow<AdminWechatContactsUiState> = mutableState.asStateFlow()

  init {
    viewModelScope.launch { refresh() }
  }

  suspend fun refresh() {
    mutableState.value = mutableState.value.copy(isLoading = true, error = null)
    when (val result = repository.listWechatContacts()) {
      is ApiResult.Success -> {
        mutableState.value = mutableState.value.copy(
          contacts = result.data,
          isLoading = false,
          error = null,
        )
      }

      is ApiResult.Failure -> {
        mutableState.value = mutableState.value.copy(
          isLoading = false,
          error = result.error.toAdminActionError(),
        )
      }
    }
  }

  suspend fun confirmSensitiveAction(credential: AdminConfirmCredential): ApiResult<AdminConfirmToken> =
    repository.confirmSensitiveAction(credential)

  suspend fun createContact(request: AdminWechatContactRequest): ApiResult<WechatContactAdminItem> =
    runMutation { repository.createWechatContact(request) }

  suspend fun updateContact(id: String, request: AdminWechatContactRequest): ApiResult<WechatContactAdminItem> =
    runMutation { repository.updateWechatContact(id, request) }

  suspend fun deleteContact(id: String): ApiResult<Unit> =
    runMutation { repository.deleteWechatContact(id) }

  private suspend fun <T> runMutation(
    block: suspend () -> ApiResult<T>,
  ): ApiResult<T> =
    when (val result = block()) {
      is ApiResult.Success -> {
        refresh()
        result
      }

      is ApiResult.Failure -> {
        mutableState.value = mutableState.value.copy(error = result.error.toAdminActionError())
        result
      }
    }
}

data class AdminReferralsUiState(
  val attributions: List<ReferralAttributionItem> = emptyList(),
  val conversions: List<ReferralConversionItem> = emptyList(),
  val isLoading: Boolean = true,
  val error: AdminActionError? = null,
)

class AdminReferralsViewModel(
  private val repository: AdminRepository,
) : ViewModel() {
  private val mutableState = MutableStateFlow(AdminReferralsUiState())
  val uiState: StateFlow<AdminReferralsUiState> = mutableState.asStateFlow()

  init {
    viewModelScope.launch { refresh() }
  }

  suspend fun refresh(limit: Int = 200) {
    mutableState.value = mutableState.value.copy(isLoading = true, error = null)
    when (
      val attributionsResult = repository.listReferralAttributions(limit)
    ) {
      is ApiResult.Failure -> {
        mutableState.value = mutableState.value.copy(
          isLoading = false,
          error = attributionsResult.error.toAdminActionError(),
        )
      }

      is ApiResult.Success -> {
        when (val conversionsResult = repository.listReferralConversions(limit)) {
          is ApiResult.Success -> {
            mutableState.value = mutableState.value.copy(
              attributions = attributionsResult.data,
              conversions = conversionsResult.data,
              isLoading = false,
              error = null,
            )
          }

          is ApiResult.Failure -> {
            mutableState.value = mutableState.value.copy(
              isLoading = false,
              error = conversionsResult.error.toAdminActionError(),
            )
          }
        }
      }
    }
  }

  suspend fun confirmSensitiveAction(credential: AdminConfirmCredential): ApiResult<AdminConfirmToken> =
    repository.confirmSensitiveAction(credential)

  suspend fun markPaid(
    id: String,
    channel: String,
    settlementRef: String,
    note: String,
  ): ApiResult<ReferralConversionItem> =
    runMutation {
      repository.markReferralConversionPaid(id, channel, settlementRef, note)
    }

  suspend fun reject(
    id: String,
    note: String,
  ): ApiResult<ReferralConversionItem> =
    runMutation {
      repository.rejectReferralConversion(id, note)
    }

  private suspend fun <T> runMutation(
    block: suspend () -> ApiResult<T>,
  ): ApiResult<T> =
    when (val result = block()) {
      is ApiResult.Success -> {
        refresh()
        result
      }

      is ApiResult.Failure -> {
        mutableState.value = mutableState.value.copy(error = result.error.toAdminActionError())
        result
      }
    }
}
