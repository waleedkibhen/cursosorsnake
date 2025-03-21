# Project Launcher Script
Write-Host "🚀 Smart Project Launcher" -ForegroundColor Cyan
Write-Host "Detecting project type..." -ForegroundColor Yellow

# Function to check if a command exists
function Test-Command($cmdname) {
    return [bool](Get-Command -Name $cmdname -ErrorAction SilentlyContinue)
}

# Function to start browser
function Start-Browser($url) {
    Start-Process $url
}

# Get the current directory
$projectPath = Get-Location

# Check for different project types
$isReact = Test-Path "package.json" -and (Get-Content "package.json" -Raw | Select-String "react")
$isNextJS = Test-Path "package.json" -and (Get-Content "package.json" -Raw | Select-String "next")
$isExpo = Test-Path "package.json" -and (Get-Content "package.json" -Raw | Select-String "expo")
$isHTML = Test-Path "*.html"
$isNode = Test-Path "package.json"

# Display detected project type
if ($isReact) {
    Write-Host "📦 Detected: React Project" -ForegroundColor Green
} elseif ($isNextJS) {
    Write-Host "📦 Detected: Next.js Project" -ForegroundColor Green
} elseif ($isExpo) {
    Write-Host "📱 Detected: React Native (Expo) Project" -ForegroundColor Green
} elseif ($isHTML) {
    Write-Host "🌐 Detected: Static HTML Project" -ForegroundColor Green
} elseif ($isNode) {
    Write-Host "📦 Detected: Node.js Project" -ForegroundColor Green
} else {
    Write-Host "📄 Detected: Other Project Type" -ForegroundColor Yellow
}

# Launch based on project type
try {
    if ($isReact -or $isNextJS) {
        # Check if dependencies are installed
        if (-not (Test-Path "node_modules")) {
            Write-Host "📥 Installing dependencies..." -ForegroundColor Yellow
            npm install
        }
        Write-Host "🚀 Starting development server..." -ForegroundColor Green
        Start-Process -NoNewWindow npm -ArgumentList "run dev"
        Start-Sleep -Seconds 3
        Start-Browser "http://localhost:3000"
    }
    elseif ($isExpo) {
        if (-not (Test-Path "node_modules")) {
            Write-Host "📥 Installing dependencies..." -ForegroundColor Yellow
            npm install
        }
        Write-Host "🚀 Starting Expo server..." -ForegroundColor Green
        Start-Process -NoNewWindow npx -ArgumentList "expo start"
    }
    elseif ($isHTML) {
        # Check if Live Server VS Code extension is installed
        $vscodePath = "$env:USERPROFILE\.vscode\extensions"
        $liveServer = Get-ChildItem -Path $vscodePath -Recurse -Filter "live-server*" -ErrorAction SilentlyContinue
        
        if ($liveServer) {
            Write-Host "🌐 Starting Live Server..." -ForegroundColor Green
            # Get the first HTML file in the directory
            $htmlFile = Get-ChildItem -Filter "*.html" | Select-Object -First 1
            code --goto "$($htmlFile.Name)" --launch-browser
        } else {
            Write-Host "⚠️ Live Server not found. Installing Python simple server..." -ForegroundColor Yellow
            if (Test-Command python) {
                Start-Process -NoNewWindow python -ArgumentList "-m http.server 8000"
                Start-Sleep -Seconds 2
                Start-Browser "http://localhost:8000"
            } else {
                Write-Host "❌ Please install Live Server extension in VS Code or Python" -ForegroundColor Red
            }
        }
    }
    elseif ($isNode) {
        if (-not (Test-Path "node_modules")) {
            Write-Host "📥 Installing dependencies..." -ForegroundColor Yellow
            npm install
        }
        Write-Host "🚀 Starting Node.js server..." -ForegroundColor Green
        $packageJson = Get-Content "package.json" -Raw | ConvertFrom-Json
        if ($packageJson.scripts.start) {
            Start-Process -NoNewWindow npm -ArgumentList "start"
        } elseif ($packageJson.scripts.dev) {
            Start-Process -NoNewWindow npm -ArgumentList "run dev"
        } else {
            Write-Host "⚠️ No start script found. Please check package.json" -ForegroundColor Yellow
        }
    }
    else {
        Write-Host "ℹ️ No specific project type detected. Opening in VS Code..." -ForegroundColor Yellow
        code .
    }

    Write-Host "`n✨ Project launched successfully!" -ForegroundColor Green
    Write-Host "Press Ctrl+C to stop the server when done." -ForegroundColor Yellow
}
catch {
    Write-Host "❌ Error: $_" -ForegroundColor Red
} 