{{- define "densify.labels" -}}
app.kubernetes.io/part-of: densify
app.kubernetes.io/managed-by: {{ .Release.Service }}
helm.sh/chart: {{ .Chart.Name }}-{{ .Chart.Version }}
{{- end }}

{{- define "densify.secretName" -}}
{{- if .Values.existingSecret }}{{ .Values.existingSecret }}{{ else }}{{ .Release.Name }}-secrets{{ end }}
{{- end }}

{{- define "densify.image" -}}
{{ .root.Values.imageRegistry }}/densify-{{ .name }}:{{ .root.Values.imageTag }}
{{- end }}

{{/* Env entries sourced from the app Secret; missing keys are tolerated (optional). */}}
{{- define "densify.secretEnv" -}}
{{- $secret := include "densify.secretName" .root -}}
{{- range .keys }}
- name: {{ . }}
  valueFrom:
    secretKeyRef:
      name: {{ $secret }}
      key: {{ . }}
      optional: true
{{- end }}
{{- end }}
