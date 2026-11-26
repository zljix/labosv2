<?php
declare(strict_types=1);
namespace Labos;

function collectionAssignment(array $assignment): bool
{
    return in_array($assignment['task']['definition']['set'] ?? null, ['iot','us','urs-lv'], true);
}

function submittedWord(array $body, array $assignment): ?array
{
    $file = $body['word'] ?? null;
    if (!collectionAssignment($assignment)) {
        if ($file !== null) fail(422,'word_unexpected','Ova dodjela nema predaju Worda.');
        return null;
    }
    if ($file === null && ($body['needsEvidence'] ?? false) === true) return null;
    if (!$file instanceof \stdClass || !is_string($file->name ?? null) || !preg_match('/^[^\\\\\/\x00-\x1F\x7F]{1,150}\.docx$/iuD',$file->name)
        || !is_string($file->base64 ?? null) || strlen($file->base64)>16777216) fail(422,'word_required','Odaberi popunjeni .docx do 12 MiB ili označi da dokazi trebaju dopunu.');
    $bytes=base64_decode($file->base64,true);
    if ($bytes===false || strlen($bytes)<22 || strlen($bytes)>12582912 || !str_starts_with($bytes,"PK\x03\x04")) fail(422,'word_format','Prilog mora biti Word dokument u formatu .docx.');
    $hash=hash('sha256',$bytes);
    if(in_array($hash,$assignment['task']['definition']['wordHashes'],true))fail(422,'word_template','Priložen je prazan početni Word. Spremi svoju dopunjenu kopiju ili označi dopunu.');
    if(!class_exists(\ZipArchive::class))fail(503,'zip_extension','Za predaju Worda uključi PHP proširenje zip na školskom poslužitelju.');
    $path=tempnam(sys_get_temp_dir(),'labos-doc-');$zip=new \ZipArchive();
    if($path===false)fail(503,'temporary_file','Privremena pohrana nije dostupna.');
    try{
        if(file_put_contents($path,$bytes)!==strlen($bytes))fail(503,'temporary_file','Privremena pohrana nije dostupna.');
        if($zip->open($path,\ZipArchive::RDONLY)!==true)fail(422,'word_format','Word arhiva nije čitljiva.');
        try{
            $types=$zip->getFromName('[Content_Types].xml',262144);
            if($zip->locateName('word/document.xml')===false || !$types || !str_contains($types,'application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml') || $zip->locateName('word/vbaProject.bin',\ZipArchive::FL_NOCASE)!==false)
                fail(422,'word_format','Odaberi Word dokument .docx bez makronaredbi.');
        }finally{$zip->close();}
    }finally{unlink($path);}
    return ['name'=>$file->name,'sha256'=>$hash,'bytes'=>$bytes];
}

function downloadSubmittedWord(\PDO $pdo,array $actor,mixed $attempt,mixed $revision): never
{
    $row=accessibleAttempt($pdo,$actor,$attempt);$rev=targetId($revision);
    $doc=query($pdo,'SELECT d.* FROM collection_documents d JOIN school_submissions s ON s.id=d.submission_id WHERE s.attempt_id=? AND s.revision=?',[$row['id'],$rev])->fetch();
    if(!$doc)fail(404,'word_missing','Ova revizija nema predani Word.');
    session_write_close();
    header('Content-Type: application/vnd.openxmlformats-officedocument.wordprocessingml.document');
    header("Content-Disposition: attachment; filename=\"predaja.docx\"; filename*=UTF-8''".rawurlencode($doc['filename']));
    header('Content-Length: '.$doc['byte_count']);echo $doc['document'];exit;
}
