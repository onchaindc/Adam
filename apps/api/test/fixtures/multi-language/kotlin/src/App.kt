import java.lang.reflect.Method
import java.sql.Statement

fun invoke(method: Method, statement: Statement, user: String) {
    method.isAccessible = true
    statement.executeQuery("SELECT * FROM users WHERE name = '$user'")
}
