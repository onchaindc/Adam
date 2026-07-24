fn read_value(value: Option<&str>) -> &str {
    unsafe { std::ptr::read(&value.unwrap()) }
}

fn stop() {
    panic!("fixture panic");
}
