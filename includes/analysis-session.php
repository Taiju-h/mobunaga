<?php
declare(strict_types=1);

// Shared by the passphrase-protected analysis room and deployment tools.
const MOBUNAGA_AUTH_LIFETIME = 12 * 60 * 60;

function mobunagaAuthCookie(int $expires): void
{
    setcookie(session_name(), session_id(), [
        'expires' => $expires,
        'path' => '/',
        'secure' => !empty($_SERVER['HTTPS']) && $_SERVER['HTTPS'] !== 'off',
        'httponly' => true,
        'samesite' => 'Strict',
    ]);
}

function mobunagaAuthorize(): void
{
    session_regenerate_id(true);
    $_SESSION['authorized'] = true;
    $_SESSION['authorized_until'] = time() + MOBUNAGA_AUTH_LIFETIME;
    mobunagaAuthCookie($_SESSION['authorized_until']);
}

// Outside the checkout so deployment does not remove sessions. Each checkout
// has its own directory, isolated from PHP's shorter-lived default sessions.
$sessionDirectory = sys_get_temp_dir() . '/mobunaga-auth-' . substr(hash('sha256', dirname(__DIR__)), 0, 16);
if (!is_dir($sessionDirectory) && !mkdir($sessionDirectory, 0700, true) && !is_dir($sessionDirectory)) {
    throw new RuntimeException('認証セッションの保存先を作成できません。');
}
ini_set('session.save_handler', 'files');
session_save_path($sessionDirectory);
ini_set('session.gc_maxlifetime', (string)MOBUNAGA_AUTH_LIFETIME);
ini_set('session.gc_probability', '1');
ini_set('session.gc_divisor', '100');
ini_set('session.use_strict_mode', '1');
ini_set('session.use_only_cookies', '1');
session_name('mobunaga_analysis_room');
session_set_cookie_params([
    'lifetime' => MOBUNAGA_AUTH_LIFETIME,
    'path' => '/',
    'secure' => !empty($_SERVER['HTTPS']) && $_SERVER['HTTPS'] !== 'off',
    'httponly' => true,
    'samesite' => 'Strict',
]);
session_start();

if (!empty($_SESSION['authorized'])) {
    if ((int)($_SESSION['authorized_until'] ?? 0) <= time()) {
        $_SESSION = [];
        session_regenerate_id(true);
        mobunagaAuthCookie(0);
    } else {
        // Preserve the original login deadline; page views never extend it.
        mobunagaAuthCookie((int)$_SESSION['authorized_until']);
    }
}
