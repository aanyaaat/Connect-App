Add-Type -AssemblyName System.Drawing

$srcPath = "c:\Projects\Connect App\public\image.png"
$src = [System.Drawing.Image]::FromFile($srcPath)

# Face crop rectangle: x: 100, y: 120, width: 700, height: 700
$cropX = 100
$cropY = 120
$cropSize = 700

$cropRect = New-Object System.Drawing.Rectangle($cropX, $cropY, $cropSize, $cropSize)
$cropped = New-Object System.Drawing.Bitmap($cropSize, $cropSize)
$gCrop = [System.Drawing.Graphics]::FromImage($cropped)
$gCrop.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
$gCrop.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::HighQuality
$gCrop.PixelOffsetMode = [System.Drawing.Drawing2D.PixelOffsetMode]::HighQuality
$gCrop.DrawImage($src, (New-Object System.Drawing.Rectangle(0, 0, $cropSize, $cropSize)), $cropRect, [System.Drawing.GraphicsUnit]::Pixel)
$gCrop.Dispose()

function Create-Circular-Bitmap($sourceBmp, $size) {
    $target = New-Object System.Drawing.Bitmap($size, $size, [System.Drawing.Imaging.PixelFormat]::Format32bppArgb)
    $g = [System.Drawing.Graphics]::FromImage($target)
    $g.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
    $g.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::HighQuality
    $g.PixelOffsetMode = [System.Drawing.Drawing2D.PixelOffsetMode]::HighQuality
    $g.Clear([System.Drawing.Color]::Transparent)

    # Circular path
    $path = New-Object System.Drawing.Drawing2D.GraphicsPath
    $path.AddEllipse(1, 1, $size - 2, $size - 2)
    $g.SetClip($path)
    $g.DrawImage($sourceBmp, 0, 0, $size, $size)
    $g.ResetClip()

    # Subtle glowing border
    $pen = New-Object System.Drawing.Pen([System.Drawing.Color]::FromArgb(255, 236, 72, 153), [Math]::Max(2, $size / 40))
    $g.DrawEllipse($pen, 1, 1, $size - 3, $size - 3)
    $pen.Dispose()
    $path.Dispose()
    $g.Dispose()
    return $target
}

function Create-Foreground-Bitmap($sourceBmp, $totalSize) {
    $target = New-Object System.Drawing.Bitmap($totalSize, $totalSize, [System.Drawing.Imaging.PixelFormat]::Format32bppArgb)
    $g = [System.Drawing.Graphics]::FromImage($target)
    $g.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
    $g.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::HighQuality
    $g.PixelOffsetMode = [System.Drawing.Drawing2D.PixelOffsetMode]::HighQuality
    $g.Clear([System.Drawing.Color]::Transparent)

    # Adaptive icons safe zone is inner 66% (e.g. 72 out of 108)
    $innerSize = [int]($totalSize * 0.72)
    $offset = [int](($totalSize - $innerSize) / 2)

    $circ = Create-Circular-Bitmap $sourceBmp $innerSize
    $g.DrawImage($circ, $offset, $offset, $innerSize, $innerSize)
    $circ.Dispose()
    $g.Dispose()
    return $target
}

function Create-Square-Bitmap($sourceBmp, $size) {
    $target = New-Object System.Drawing.Bitmap($size, $size)
    $g = [System.Drawing.Graphics]::FromImage($target)
    $g.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
    $g.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::HighQuality
    $g.PixelOffsetMode = [System.Drawing.Drawing2D.PixelOffsetMode]::HighQuality
    $g.DrawImage($sourceBmp, 0, 0, $size, $size)
    $g.Dispose()
    return $target
}

# Android mipmap densities
$densities = @{
    "mipmap-mdpi" = @{ size = 48; fgSize = 108 };
    "mipmap-hdpi" = @{ size = 72; fgSize = 162 };
    "mipmap-xhdpi" = @{ size = 96; fgSize = 216 };
    "mipmap-xxhdpi" = @{ size = 144; fgSize = 324 };
    "mipmap-xxxhdpi" = @{ size = 192; fgSize = 432 }
}

$resBase = "c:\Projects\Connect App\android\app\src\main\res"

foreach ($name in $densities.Keys) {
    $dir = Join-Path $resBase $name
    if (-not (Test-Path $dir)) { New-Item -ItemType Directory -Path $dir -Force }
    $cfg = $densities[$name]

    # ic_launcher.png (Square/Squircle)
    $sq = Create-Square-Bitmap $cropped $cfg.size
    $sq.Save((Join-Path $dir "ic_launcher.png"), [System.Drawing.Imaging.ImageFormat]::Png)
    $sq.Dispose()

    # ic_launcher_round.png (Circular)
    $round = Create-Circular-Bitmap $cropped $cfg.size
    $round.Save((Join-Path $dir "ic_launcher_round.png"), [System.Drawing.Imaging.ImageFormat]::Png)
    $round.Dispose()

    # ic_launcher_foreground.png (Adaptive Foreground)
    $fg = Create-Foreground-Bitmap $cropped $cfg.fgSize
    $fg.Save((Join-Path $dir "ic_launcher_foreground.png"), [System.Drawing.Imaging.ImageFormat]::Png)
    $fg.Dispose()
}

# Also update web public icons
$pubDir = "c:\Projects\Connect App\public"
$icon512 = Create-Square-Bitmap $cropped 512
$icon512.Save((Join-Path $pubDir "icon-512.png"), [System.Drawing.Imaging.ImageFormat]::Png)
$icon512.Dispose()

$icon192 = Create-Square-Bitmap $cropped 192
$icon192.Save((Join-Path $pubDir "icon-192.png"), [System.Drawing.Imaging.ImageFormat]::Png)
$icon192.Dispose()

$fav = Create-Circular-Bitmap $cropped 64
$fav.Save((Join-Path $pubDir "favicon.png"), [System.Drawing.Imaging.ImageFormat]::Png)
$fav.Dispose()

$cropped.Dispose()
$src.Dispose()
Write-Host "All Android mipmap and Web icons successfully generated from Aanya photo!"
