Add-Type -AssemblyName System.Speech
$synth = New-Object System.Speech.Synthesis.SpeechSynthesizer
$synth.SelectVoice('Microsoft Irina Desktop')
$synth.Rate = 1
$output = Join-Path $PSScriptRoot 'speech-parts'
New-Item -ItemType Directory -Force -Path $output | Out-Null
$phrases = @(
  'Нужно согласовать договор до конца недели.',
  'Дана подготовит проект, я проверю условия.',
  'На следующей неделе обсудим это с поставщиком.',
  'Келесі аптада жеткізушімен талқылаймыз.'
)
for ($i = 0; $i -lt $phrases.Count; $i++) {
  $synth.SetOutputToWaveFile((Join-Path $output "$i.wav"))
  $synth.Speak($phrases[$i])
}
$synth.Dispose()
