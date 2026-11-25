# Read one scanned page locally using Windows' PDF renderer and English OCR.
param([Parameter(Mandatory=$true)][string]$Path, [int]$Page=1)
$ErrorActionPreference='Stop'
Add-Type -AssemblyName System.Runtime.WindowsRuntime
$null=[Windows.Data.Pdf.PdfDocument,Windows.Data.Pdf,ContentType=WindowsRuntime]
$null=[Windows.Storage.StorageFile,Windows.Storage,ContentType=WindowsRuntime]
$null=[Windows.Storage.Streams.InMemoryRandomAccessStream,Windows.Storage.Streams,ContentType=WindowsRuntime]
$null=[Windows.Graphics.Imaging.BitmapDecoder,Windows.Graphics.Imaging,ContentType=WindowsRuntime]
$null=[Windows.Graphics.Imaging.SoftwareBitmap,Windows.Graphics.Imaging,ContentType=WindowsRuntime]
$null=[Windows.Media.Ocr.OcrEngine,Windows.Foundation,ContentType=WindowsRuntime]
$null=[Windows.Media.Ocr.OcrResult,Windows.Foundation,ContentType=WindowsRuntime]
$methods=[System.WindowsRuntimeSystemExtensions].GetMethods() | Where-Object {$_.Name -eq 'AsTask' -and $_.GetParameters().Count -eq 1}
$op=$methods | Where-Object {$_.GetParameters()[0].ParameterType.Name -eq 'IAsyncOperation`1'} | Select-Object -First 1
$act=$methods | Where-Object {$_.GetParameters()[0].ParameterType.Name -eq 'IAsyncAction'} | Select-Object -First 1
function Result($operation,$type) {
  $task=$op.MakeGenericMethod($type).Invoke($null,@($operation))
  $task.Wait()
  $task.Result
}
$f=Result ([Windows.Storage.StorageFile]::GetFileFromPathAsync((Resolve-Path $Path).Path)) ([Windows.Storage.StorageFile])
$pdf=Result ([Windows.Data.Pdf.PdfDocument]::LoadFromFileAsync($f)) ([Windows.Data.Pdf.PdfDocument])
$p=$pdf.GetPage($Page-1)
$stream=[Windows.Storage.Streams.InMemoryRandomAccessStream]::new()
try {
  $options=[Windows.Data.Pdf.PdfPageRenderOptions,Windows.Data.Pdf,ContentType=WindowsRuntime]::new()
  $options.DestinationWidth=1600
  $act.Invoke($null,@($p.RenderToStreamAsync($stream,$options))).Wait()
  $stream.Seek(0)
  $decoder=Result ([Windows.Graphics.Imaging.BitmapDecoder]::CreateAsync($stream)) ([Windows.Graphics.Imaging.BitmapDecoder])
  $bitmap=Result ($decoder.GetSoftwareBitmapAsync()) ([Windows.Graphics.Imaging.SoftwareBitmap])
  $engine=[Windows.Media.Ocr.OcrEngine]::TryCreateFromUserProfileLanguages()
  $text=Result ($engine.RecognizeAsync($bitmap)) ([Windows.Media.Ocr.OcrResult])
  "Page $Page of $($pdf.PageCount)"
  $text.Lines | ForEach-Object Text
} finally { $p.Dispose(); $stream.Dispose() }
