package com.xyzw.helper.ui.components

import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.ColumnScope
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.RowScope
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.heightIn
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.outlined.ErrorOutline
import androidx.compose.material3.Button
import androidx.compose.material3.CardDefaults
import androidx.compose.material3.DividerDefaults
import androidx.compose.material3.ElevatedCard
import androidx.compose.material3.HorizontalDivider
import androidx.compose.material3.Icon
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedButton
import androidx.compose.material3.Scaffold
import androidx.compose.material3.SnackbarHost
import androidx.compose.material3.SnackbarHostState
import androidx.compose.material3.Surface
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.remember
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.vector.ImageVector
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp

data class SummaryMetric(
  val label: String,
  val value: String,
  val meta: String = "",
  val tone: String = "info",
)

data class ActionGridItem(
  val title: String,
  val description: String,
  val icon: ImageVector? = null,
  val badge: String? = null,
  val enabled: Boolean = true,
  val onClick: () -> Unit,
)

@Composable
fun AppHero(
  eyebrow: String,
  title: String,
  description: String,
  modifier: Modifier = Modifier,
  meta: @Composable RowScope.() -> Unit = {},
  actions: @Composable RowScope.() -> Unit = {},
) {
  ElevatedCard(
    modifier = modifier.fillMaxWidth(),
    shape = RoundedCornerShape(8.dp),
    colors = CardDefaults.elevatedCardColors(
      containerColor = MaterialTheme.colorScheme.primaryContainer.copy(alpha = 0.72f),
    ),
    elevation = CardDefaults.elevatedCardElevation(defaultElevation = 1.dp),
  ) {
    Column(
      modifier = Modifier.padding(18.dp),
      verticalArrangement = Arrangement.spacedBy(14.dp),
    ) {
      Column(verticalArrangement = Arrangement.spacedBy(6.dp)) {
        Text(
          text = eyebrow,
          style = MaterialTheme.typography.labelMedium,
          color = MaterialTheme.colorScheme.primary,
          fontWeight = FontWeight.SemiBold,
        )
        Text(
          text = title,
          style = MaterialTheme.typography.headlineSmall,
          fontWeight = FontWeight.SemiBold,
        )
        Text(
          text = description,
          style = MaterialTheme.typography.bodyMedium,
          color = MaterialTheme.colorScheme.onSurfaceVariant,
        )
      }
      Row(
        modifier = Modifier.fillMaxWidth(),
        horizontalArrangement = Arrangement.spacedBy(8.dp),
        verticalAlignment = Alignment.CenterVertically,
        content = meta,
      )
      Row(
        modifier = Modifier.fillMaxWidth(),
        horizontalArrangement = Arrangement.spacedBy(10.dp),
        content = actions,
      )
    }
  }
}

@Composable
fun SummaryGrid(
  items: List<SummaryMetric>,
  modifier: Modifier = Modifier,
) {
  Column(modifier = modifier.fillMaxWidth(), verticalArrangement = Arrangement.spacedBy(10.dp)) {
    items.chunked(2).forEach { row ->
      Row(modifier = Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.spacedBy(10.dp)) {
        row.forEach { item ->
          SummaryMetricCard(item = item, modifier = Modifier.weight(1f))
        }
        if (row.size == 1) {
          Surface(modifier = Modifier.weight(1f), color = androidx.compose.ui.graphics.Color.Transparent) {}
        }
      }
    }
  }
}

@Composable
fun SummaryMetricCard(
  item: SummaryMetric,
  modifier: Modifier = Modifier,
) {
  ElevatedCard(
    modifier = modifier.heightIn(min = 88.dp),
    shape = RoundedCornerShape(8.dp),
    colors = CardDefaults.elevatedCardColors(containerColor = MaterialTheme.colorScheme.surfaceVariant.copy(alpha = 0.76f)),
    elevation = CardDefaults.elevatedCardElevation(defaultElevation = 1.dp),
  ) {
    Column(modifier = Modifier.padding(12.dp), verticalArrangement = Arrangement.spacedBy(4.dp)) {
      Text(item.label, style = MaterialTheme.typography.labelMedium, color = MaterialTheme.colorScheme.onSurfaceVariant)
      Text(
        text = item.value.ifBlank { "--" },
        style = MaterialTheme.typography.titleMedium,
        fontWeight = FontWeight.SemiBold,
        maxLines = 2,
        overflow = TextOverflow.Ellipsis,
      )
      item.meta.takeIf { it.isNotBlank() }?.let {
        Text(it, style = MaterialTheme.typography.bodySmall, color = MaterialTheme.colorScheme.onSurfaceVariant)
      }
    }
  }
}

@Composable
fun SectionCard(
  title: String,
  description: String? = null,
  modifier: Modifier = Modifier,
  headerExtra: @Composable RowScope.() -> Unit = {},
  content: @Composable ColumnScope.() -> Unit,
) {
  ElevatedCard(
    modifier = modifier.fillMaxWidth(),
    shape = RoundedCornerShape(8.dp),
    colors = CardDefaults.elevatedCardColors(containerColor = MaterialTheme.colorScheme.surface),
    elevation = CardDefaults.elevatedCardElevation(defaultElevation = 1.dp),
  ) {
    Column(modifier = Modifier.padding(16.dp), verticalArrangement = Arrangement.spacedBy(12.dp)) {
      Row(
        modifier = Modifier.fillMaxWidth(),
        horizontalArrangement = Arrangement.spacedBy(12.dp),
        verticalAlignment = Alignment.Top,
      ) {
        Column(modifier = Modifier.weight(1f), verticalArrangement = Arrangement.spacedBy(3.dp)) {
          Text(title, style = MaterialTheme.typography.titleMedium, fontWeight = FontWeight.SemiBold)
          if (!description.isNullOrBlank()) {
            Text(description, style = MaterialTheme.typography.bodySmall, color = MaterialTheme.colorScheme.onSurfaceVariant)
          }
        }
        headerExtra()
      }
      content()
    }
  }
}

@Composable
fun ActionGrid(
  items: List<ActionGridItem>,
  modifier: Modifier = Modifier,
) {
  Column(modifier = modifier.fillMaxWidth(), verticalArrangement = Arrangement.spacedBy(10.dp)) {
    items.chunked(2).forEach { row ->
      Row(modifier = Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.spacedBy(10.dp)) {
        row.forEach { item ->
          ActionGridCard(item = item, modifier = Modifier.weight(1f))
        }
        if (row.size == 1) {
          Surface(modifier = Modifier.weight(1f), color = androidx.compose.ui.graphics.Color.Transparent) {}
        }
      }
    }
  }
}

@Composable
private fun ActionGridCard(
  item: ActionGridItem,
  modifier: Modifier,
) {
  ElevatedCard(
    onClick = item.onClick,
    enabled = item.enabled,
    modifier = modifier.heightIn(min = 132.dp),
    shape = RoundedCornerShape(8.dp),
    colors = CardDefaults.elevatedCardColors(containerColor = MaterialTheme.colorScheme.surfaceVariant.copy(alpha = 0.8f)),
  ) {
    Column(modifier = Modifier.padding(14.dp), verticalArrangement = Arrangement.spacedBy(8.dp)) {
      Row(horizontalArrangement = Arrangement.spacedBy(8.dp), verticalAlignment = Alignment.CenterVertically) {
        if (item.icon != null) {
          Icon(item.icon, contentDescription = null, modifier = Modifier.size(24.dp), tint = MaterialTheme.colorScheme.primary)
        }
        Text(item.title, style = MaterialTheme.typography.titleSmall, fontWeight = FontWeight.SemiBold)
      }
      Text(
        item.description,
        style = MaterialTheme.typography.bodySmall,
        color = MaterialTheme.colorScheme.onSurfaceVariant,
        maxLines = 4,
        overflow = TextOverflow.Ellipsis,
      )
      item.badge?.takeIf { it.isNotBlank() }?.let {
        Text(it, style = MaterialTheme.typography.labelMedium, color = MaterialTheme.colorScheme.primary)
      }
    }
  }
}

@Composable
fun PageToolbar(
  title: String,
  description: String,
  modifier: Modifier = Modifier,
  actions: @Composable RowScope.() -> Unit,
) {
  SectionCard(
    title = title,
    description = description,
    modifier = modifier,
  ) {
    Row(
      modifier = Modifier.fillMaxWidth(),
      horizontalArrangement = Arrangement.spacedBy(8.dp),
      verticalAlignment = Alignment.CenterVertically,
      content = actions,
    )
  }
}

@Composable
fun MobileDataCard(
  title: String,
  subtitle: String? = null,
  modifier: Modifier = Modifier,
  status: @Composable RowScope.() -> Unit = {},
  content: @Composable ColumnScope.() -> Unit = {},
  actions: @Composable RowScope.() -> Unit = {},
) {
  ElevatedCard(
    modifier = modifier.fillMaxWidth(),
    shape = RoundedCornerShape(8.dp),
    colors = CardDefaults.elevatedCardColors(containerColor = MaterialTheme.colorScheme.surfaceVariant.copy(alpha = 0.75f)),
    elevation = CardDefaults.elevatedCardElevation(defaultElevation = 1.dp),
  ) {
    Column(modifier = Modifier.padding(14.dp), verticalArrangement = Arrangement.spacedBy(10.dp)) {
      Row(
        modifier = Modifier.fillMaxWidth(),
        horizontalArrangement = Arrangement.spacedBy(10.dp),
        verticalAlignment = Alignment.Top,
      ) {
        Column(modifier = Modifier.weight(1f), verticalArrangement = Arrangement.spacedBy(3.dp)) {
          Text(title, style = MaterialTheme.typography.titleMedium, fontWeight = FontWeight.SemiBold)
          if (!subtitle.isNullOrBlank()) {
            Text(subtitle, style = MaterialTheme.typography.bodySmall, color = MaterialTheme.colorScheme.onSurfaceVariant)
          }
        }
        status()
      }
      content()
      Row(modifier = Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.spacedBy(8.dp), content = actions)
    }
  }
}

@Composable
fun DenseInfoRow(
  label: String,
  value: String,
  modifier: Modifier = Modifier,
  supportingText: String? = null,
) {
  Row(
    modifier = modifier.fillMaxWidth(),
    horizontalArrangement = Arrangement.spacedBy(12.dp),
    verticalAlignment = Alignment.Top,
  ) {
    Text(label, modifier = Modifier.weight(0.42f), style = MaterialTheme.typography.labelMedium, color = MaterialTheme.colorScheme.onSurfaceVariant)
    Column(modifier = Modifier.weight(0.58f), verticalArrangement = Arrangement.spacedBy(2.dp)) {
      Text(value.ifBlank { "--" }, style = MaterialTheme.typography.bodyMedium, fontWeight = FontWeight.Medium)
      if (!supportingText.isNullOrBlank()) {
        Text(supportingText, style = MaterialTheme.typography.bodySmall, color = MaterialTheme.colorScheme.onSurfaceVariant)
      }
    }
  }
}

@Composable
fun AdminSurfacePage(
  title: String,
  onBack: () -> Unit,
  snackbarHostState: SnackbarHostState = remember { SnackbarHostState() },
  actions: @Composable RowScope.() -> Unit = {},
  content: @Composable ColumnScope.() -> Unit,
) {
  Scaffold(
    snackbarHost = { SnackbarHost(snackbarHostState) },
    topBar = {
      XyzwTopBar(
        title = title,
        onBack = onBack,
        actions = actions,
      )
    },
  ) { innerPadding ->
    LazyColumn(
      modifier = Modifier
        .fillMaxSize()
        .padding(innerPadding)
        .padding(horizontal = 16.dp, vertical = 16.dp),
      verticalArrangement = Arrangement.spacedBy(14.dp),
      contentPadding = PaddingValues(bottom = 16.dp),
    ) {
      item {
        Column(verticalArrangement = Arrangement.spacedBy(14.dp), content = content)
      }
    }
  }
}

@Composable
fun AdminOverviewStrip(
  metrics: List<SummaryMetric>,
  modifier: Modifier = Modifier,
) {
  SummaryGrid(items = metrics, modifier = modifier)
}

@Composable
fun DangerZoneCard(
  title: String,
  description: String,
  modifier: Modifier = Modifier,
  content: @Composable ColumnScope.() -> Unit,
) {
  ElevatedCard(
    modifier = modifier.fillMaxWidth(),
    shape = RoundedCornerShape(8.dp),
    colors = CardDefaults.elevatedCardColors(containerColor = MaterialTheme.colorScheme.errorContainer.copy(alpha = 0.42f)),
  ) {
    Column(modifier = Modifier.padding(16.dp), verticalArrangement = Arrangement.spacedBy(12.dp)) {
      Row(horizontalArrangement = Arrangement.spacedBy(10.dp), verticalAlignment = Alignment.Top) {
        Icon(Icons.Outlined.ErrorOutline, contentDescription = null, tint = MaterialTheme.colorScheme.error)
        Column(modifier = Modifier.weight(1f), verticalArrangement = Arrangement.spacedBy(3.dp)) {
          Text(title, style = MaterialTheme.typography.titleMedium, fontWeight = FontWeight.SemiBold)
          Text(description, style = MaterialTheme.typography.bodySmall, color = MaterialTheme.colorScheme.onSurfaceVariant)
        }
      }
      HorizontalDivider(color = DividerDefaults.color.copy(alpha = 0.6f))
      content()
    }
  }
}

@Composable
fun SurfacePrimaryButton(
  text: String,
  onClick: () -> Unit,
  modifier: Modifier = Modifier,
  enabled: Boolean = true,
) {
  Button(onClick = onClick, enabled = enabled, modifier = modifier.heightIn(min = 48.dp)) {
    Text(text, maxLines = 1, overflow = TextOverflow.Ellipsis)
  }
}

@Composable
fun SurfaceSecondaryButton(
  text: String,
  onClick: () -> Unit,
  modifier: Modifier = Modifier,
  enabled: Boolean = true,
) {
  OutlinedButton(onClick = onClick, enabled = enabled, modifier = modifier.heightIn(min = 48.dp)) {
    Text(text, maxLines = 1, overflow = TextOverflow.Ellipsis)
  }
}
