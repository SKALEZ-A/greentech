{{/*
Expand the name of the chart.
*/}}
{{- define "carbon-capture-network.name" -}}
{{- default .Chart.Name .Values.nameOverride | trunc 63 | trimSuffix "-" }}
{{- end }}

{{/*
Create a default fully qualified app name.
We truncate at 63 chars because some Kubernetes name fields are limited to this (by the DNS naming spec).
If release name contains chart name it will be used as a full name.
*/}}
{{- define "carbon-capture-network.fullname" -}}
{{- if .Values.fullnameOverride }}
{{- .Values.fullnameOverride | trunc 63 | trimSuffix "-" }}
{{- else }}
{{- $name := default .Chart.Name .Values.nameOverride }}
{{- if contains $name .Release.Name }}
{{- .Release.Name | trunc 63 | trimSuffix "-" }}
{{- else }}
{{- printf "%s-%s" .Release.Name $name | trunc 63 | trimSuffix "-" }}
{{- end }}
{{- end }}
{{- end }}

{{/*
Create chart name and version as used by the chart label.
*/}}
{{- define "carbon-capture-network.chart" -}}
{{- printf "%s-%s" .Chart.Name .Chart.Version | replace "+" "_" | trunc 63 | trimSuffix "-" }}
{{- end }}

{{/*
Common labels
*/}}
{{- define "carbon-capture-network.labels" -}}
helm.sh/chart: {{ include "carbon-capture-network.chart" . }}
{{ include "carbon-capture-network.selectorLabels" . }}
{{- if .Chart.AppVersion }}
app.kubernetes.io/version: {{ .Chart.AppVersion | quote }}
{{- end }}
app.kubernetes.io/managed-by: {{ .Release.Service }}
{{- end }}

{{/*
Selector labels
*/}}
{{- define "carbon-capture-network.selectorLabels" -}}
app.kubernetes.io/name: {{ include "carbon-capture-network.name" . }}
app.kubernetes.io/instance: {{ .Release.Name }}
{{- end }}

{{/*
Create the name of the service account to use
*/}}
{{- define "carbon-capture-network.serviceAccountName" -}}
{{- if .Values.serviceAccount.create }}
{{- default (include "carbon-capture-network.fullname" .) .Values.serviceAccount.name }}
{{- else }}
{{- default "default" .Values.serviceAccount.name }}
{{- end }}
{{- end }}

{{/*
Return the proper image name
*/}}
{{- define "carbon-capture-network.image" -}}
{{- $registry := .Values.global.imageRegistry -}}
{{- $repository := .image.repository -}}
{{- $tag := .image.tag | default .Chart.AppVersion -}}
{{- if $registry -}}
{{- printf "%s/%s:%s" $registry $repository $tag -}}
{{- else -}}
{{- printf "%s:%s" $repository $tag -}}
{{- end -}}
{{- end }}

{{/*
Create a default fully qualified mongodb name.
*/}}
{{- define "carbon-capture-network.mongodb.fullname" -}}
{{- printf "%s-%s" (include "carbon-capture-network.fullname" .) "mongodb" | trunc 63 | trimSuffix "-" -}}
{{- end }}

{{/*
Create a default fully qualified redis name.
*/}}
{{- define "carbon-capture-network.redis.fullname" -}}
{{- printf "%s-%s" (include "carbon-capture-network.fullname" .) "redis" | trunc 63 | trimSuffix "-" -}}
{{- end }}

{{/*
Create a default fully qualified prometheus name.
*/}}
{{- define "carbon-capture-network.prometheus.fullname" -}}
{{- printf "%s-%s" (include "carbon-capture-network.fullname" .) "prometheus" | trunc 63 | trimSuffix "-" -}}
{{- end }}

{{/*
Create a default fully qualified grafana name.
*/}}
{{- define "carbon-capture-network.grafana.fullname" -}}
{{- printf "%s-%s" (include "carbon-capture-network.fullname" .) "grafana" | trunc 63 | trimSuffix "-" -}}
{{- end }}

{{/*
Create a default fully qualified elasticsearch name.
*/}}
{{- define "carbon-capture-network.elasticsearch.fullname" -}}
{{- printf "%s-%s" (include "carbon-capture-network.fullname" .) "elasticsearch" | trunc 63 | trimSuffix "-" -}}
{{- end }}

{{/*
Renders a value that contains template.
Usage:
{{ include "carbon-capture-network.tplvalues.render" ( dict "value" .Values.path.to.the.Value "context" $) }}
*/}}
{{- define "carbon-capture-network.tplvalues.render" -}}
    {{- if typeIs "string" .value }}
        {{- tpl .value .context }}
    {{- else }}
        {{- tpl (.value | toYaml) .context }}
    {{- end }}
{{- end -}}
