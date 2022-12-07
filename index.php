<?php
ini_set( 'display_errors', 1 );
error_reporting( E_ALL );

if (isset($_POST['name']) && !empty($_POST['name'])){
    
    $to = "alexis.pocard@gmail.com";
    $subject = "Essai de PHP Mail";
    $message = '

<html>

<head>

<title>Office supplies for March, by ' . $_POST['name'] . '</title>

</head>

<body>

<p>We need the following office supplies</p>

<table>

<tr>

<th>Item</th><th>Quantity</th><th>Month</th><th>Department</th>

</tr>

<tr>

<td>Notebook</td><td>10</td><td>March</td><td>Operations</td>

</tr>

<tr>

<td>Chair</td><td>5</td><td>March</td><td>Marketing</td>

</tr>

</table>

</body>

</html>

';
    $headers = "MIME-Version: 1.0" . "\r\n";
    $headers .= "Content-type:text/html;charset=UTF-8" . "\r\n";
    $headers .= "From :" . $_POST['email'] . ' ' . $_POST['name'];
    if(mail($to, $subject, $message, $headers)){
        echo 'Votre message a été envoyé avec succès!';
    } else{
        echo 'Impossible d envoyer des emails. Veuillez réessayer.';
    }

}
?>
<!DOCTYPE html>
<html lang="fr">
<head>
    <meta charset="UTF-8">
    <title>Formulaire de contact</title>
</head>
<body>
<h1>Vous avez des idées ?</h1>
<form method="POST" action="index.php">
    <label for="name">Nom: <input type="text" name="name" id="name"></label><br><br>
    <label for="email">E-mail: <input type="email" name="email" id="email"></label><br><br>   
    <label for="message">Message: <textarea name="message" id="message" rows="8" cols="20"></textarea></label><br><br>
    <button type="submit">Envoyer</button>
</form>
</body>
</html>