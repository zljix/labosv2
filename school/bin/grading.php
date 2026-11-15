<?php
declare(strict_types=1);
if (PHP_SAPI !== 'cli') { http_response_code(404); exit; }
ini_set('display_errors','0');
require dirname(__DIR__) . '/app/bootstrap.php';
try {
    $config=Labos\configuration($argv[2]??null); $pdo=Labos\database($config);
    if (($argv[1]??'')==='claim') $value=['job'=>Labos\claimGrading($pdo)];
    elseif (($argv[1]??'')==='complete') {
        $raw=stream_get_contents(STDIN,131073); if(strlen($raw)>131072) Labos\fail(422,'size','Prevelik izvještaj.');
        $value=Labos\completeGrading($pdo,json_decode($raw,true,32,JSON_THROW_ON_ERROR));
    } else Labos\fail(422,'command','Naredbe: claim, complete.');
    echo json_encode(['ok'=>true]+$value,JSON_THROW_ON_ERROR|JSON_UNESCAPED_UNICODE).PHP_EOL;
} catch (Labos\ApiError $e) { fwrite(STDERR,json_encode(['ok'=>false,'error'=>$e->errorCode,'message'=>$e->getMessage()]).PHP_EOL);exit(2); }
catch (Throwable $e) {
    // Private diagnostics contain codes only, never SQL, DSN or credentials.
    if ($e instanceof PDOException) fwrite(STDERR,json_encode(['databaseError'=>true,'sqlState'=>(string)$e->getCode(),'driverCode'=>(int)($e->errorInfo[1]??0)]).PHP_EOL);
    fwrite(STDERR,"Servis provjere nije dostupan. Provjeri privatnu konfiguraciju i migracije.\n");exit(2);
}
