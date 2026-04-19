package com.xyzw.helper.data.token

const val MAX_BIN_UPLOAD_BYTES: Long = 32L * 1024L * 1024L

fun validateBinUploadSize(sizeBytes: Long?): String? {
  if (sizeBytes == null || sizeBytes < 0) {
    return null
  }
  return if (sizeBytes > MAX_BIN_UPLOAD_BYTES) {
    "二进制文件超过 32MB 上限，请选择更小的文件"
  } else {
    null
  }
}
