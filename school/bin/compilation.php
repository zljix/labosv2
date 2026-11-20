<?php
declare(strict_types=1);
if(PHP_SAPI!=='cli'){http_response_code(404);exit;}
require dirname(__DIR__).'/app/bootstrap.php';
try {
    $config=Labos\configuration($argv[2]??null);$pdo=Labos\database($config);$action=$argv[1]??'';
    $raw=stream_get_contents(STDIN,1500001);if(strlen($raw)>1500000)throw new RuntimeException('size');
    $body=$raw===''?[]:json_decode($raw,true,64,JSON_THROW_ON_ERROR);
    if($action==='claim')$out=['job'=>Labos\claimCompile($pdo,$config)];
    elseif($action==='complete')$out=Labos\completeCompile($pdo,$body);
    elseif($action==='heartbeat'){
        $targets=$body['targets']??[];if(!is_array($targets)||count($targets)>3)throw new RuntimeException('targets');
        Labos\query($pdo,'UPDATE compiler_service SET heartbeat=CURRENT_TIMESTAMP(6),targets=? WHERE id=1',[json_encode((object)$targets,JSON_THROW_ON_ERROR)]);$out=['ok'=>true];
    }elseif($action==='active'){
        $r=Labos\query($pdo,"SELECT id FROM compile_jobs WHERE id=? AND lease_hash=? AND status='running' AND lease_until>CURRENT_TIMESTAMP(6)",[Labos\targetId($body['id']??null),hash('sha256',(string)($body['lease']??''))])->fetch();
        $out=['active'=>(bool)$r && Labos\compilerEnabled($config)];
    }elseif($action==='cleanup'){Labos\expireCompiles($pdo);$out=['ok'=>true];}
    else throw new RuntimeException('command');
    echo json_encode($out,JSON_THROW_ON_ERROR|JSON_UNESCAPED_UNICODE).PHP_EOL;
}catch(Throwable $e){fwrite(STDERR,"Servis prevođenja nije dostupan. Provjeri konfiguraciju i migraciju 008.\n");exit(2);}
