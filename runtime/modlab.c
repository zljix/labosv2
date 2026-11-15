// MIT License; Copyright (c) 2026 ESP32 MicroPython Lab contributors.
#include <emscripten.h>
#include "py/runtime.h"
#include "py/objstr.h"
#include "py/mperrno.h"

EM_JS(int, lab_read_js, (int pin, int pull), {
    return Module.labHost.read(pin, pull);
});
EM_JS(int, lab_write_js, (int pin, int value), {
    return Module.labHost.write(pin, value) || 0;
});
EM_JS(int, lab_mode_js, (int pin, int output, int pull, int value), {
    return Module.labHost.mode(pin, output, pull, value) || 0;
});
EM_JS(int, lab_adc_js, (int pin), { return Module.labHost.adc(pin); });
EM_JS(int, lab_pwm_js, (int pin, int freq, int duty), {
    return Module.labHost.pwm(pin, freq, duty) || 0;
});
EM_JS(int, lab_i2c_present_js, (int sda, int scl, int addr), {
    return Module.labHost.i2cPresent(sda, scl, addr) ? 1 : 0;
});
EM_JS(void, lab_i2c_write_js, (const uint8_t *data, int length), {
    Module.labHost.i2cWrite(HEAPU8.slice(data, data + length));
});
EM_JS(int, lab_i2c_byte_js, (int index), {
    return Module.labHost.i2cByte(index);
});
EM_JS(int, lab_bus_config_js, (int id, int sda, int scl, int freq), {
    return Module.labHost.i2cConfig(id, sda, scl, freq);
});
EM_JS(int, lab_bus_probe_js, (int id, int addr), {
    return Module.labHost.i2cProbe(id, addr) ? 1 : 0;
});
EM_JS(int, lab_bus_tx_js, (int id, int addr, const uint8_t *data, int length, int stop), {
    return Module.labHost.i2cTx(id, addr, HEAPU8.slice(data, data + length), stop);
});
EM_JS(int, lab_bus_rx_js, (int id, int addr, uint8_t *data, int length, int stop), {
    const result = Module.labHost.i2cRx(id, addr, length, stop);
    if (typeof result === 'number') return result;
    HEAPU8.set(result, data);
    return result.length;
});
EM_JS(void, lab_frame_js, (const uint8_t *data, int length), {
    Module.labHost.frame(HEAPU8.slice(data, data + length));
});

// Generic virtual microsecond primitives; they exchange GPIO levels, not DHT data.
// Stage 16: generic SPI bytes; CS and D/C remain ordinary GPIO nets.
EM_JS(int, lab_spi_config_js, (int id, int sck, int mosi, int miso, int freq, int mode, int firstbit), {
    return Module.labHost.spiConfig?.(id,sck,mosi,miso,freq,mode,firstbit) ?? -95;
});
EM_JS(int, lab_spi_exchange_js, (int id, const uint8_t *tx, uint8_t *rx, int length), {
    const result = Module.labHost.spiExchange?.(id,HEAPU8.slice(tx,tx+length)) ?? -95;
    if (typeof result === 'number') return result;
    HEAPU8.set(result,rx); return result.length;
});
static mp_obj_t lab_spi_config(size_t n_args, const mp_obj_t *args) {
    int result=lab_spi_config_js(mp_obj_get_int(args[0]),mp_obj_get_int(args[1]),mp_obj_get_int(args[2]),mp_obj_get_int(args[3]),mp_obj_get_int(args[4]),mp_obj_get_int(args[5]),mp_obj_get_int(args[6]));
    if(result<0)mp_raise_OSError(-result);return mp_const_none;
}
static MP_DEFINE_CONST_FUN_OBJ_VAR_BETWEEN(lab_spi_config_obj,7,7,lab_spi_config);
static mp_obj_t lab_spi_exchange(mp_obj_t id,mp_obj_t data) {
    mp_buffer_info_t buf;mp_get_buffer_raise(data,&buf,MP_BUFFER_READ);
    if(buf.len>4096)mp_raise_ValueError(MP_ERROR_TEXT("SPI limit is 4096 bytes per call"));
    vstr_t out;vstr_init_len(&out,buf.len);
    int result=lab_spi_exchange_js(mp_obj_get_int(id),buf.buf,(uint8_t *)out.buf,buf.len);
    if(result<0){vstr_clear(&out);mp_raise_OSError(-result);}
    return mp_obj_new_bytes_from_vstr(&out);
}
static MP_DEFINE_CONST_FUN_OBJ_2(lab_spi_exchange_obj,lab_spi_exchange);
EM_JS(int, lab_pulse_js, (int pin, int level, int timeout), { return Module.labHost.timePulseUs ? Module.labHost.timePulseUs(pin, level, timeout) : -2; });
EM_JS(int, lab_timing_js, (int token), { return token < 0 ? Module.labHost.timingBegin() : (Module.labHost.timingEnd(token), 0); });
static mp_obj_t lab_pulse(mp_obj_t pin, mp_obj_t level, mp_obj_t timeout) {
    return mp_obj_new_int(lab_pulse_js(mp_obj_get_int(pin), mp_obj_is_true(level), mp_obj_get_int(timeout)));
}
static MP_DEFINE_CONST_FUN_OBJ_3(lab_pulse_obj, lab_pulse);
static mp_obj_t lab_timing(mp_obj_t token) { return mp_obj_new_int(lab_timing_js(mp_obj_get_int(token))); }
static MP_DEFINE_CONST_FUN_OBJ_1(lab_timing_obj, lab_timing);

static int lab_pin(mp_obj_t pin) {
    int id = mp_obj_get_int(pin);
    if (!((id >= 0 && id <= 21) || (id >= 38 && id <= 48))) {
        mp_raise_ValueError(MP_ERROR_TEXT("GPIO unavailable on reference N16R8 board"));
    }
    return id;
}
static void lab_require_ok(int status) {
    if (status == -3) mp_raise_ValueError(MP_ERROR_TEXT("ESP32-S3 supports at most 8 PWM channels"));
    if (status == -4) mp_raise_msg(&mp_type_NotImplementedError, MP_ERROR_TEXT("PWM requires an editable circuit"));
    if (status < 0) mp_raise_msg(&mp_type_RuntimeError, MP_ERROR_TEXT("Electrical output conflict; check circuit diagnostics"));
}
static mp_obj_t lab_mode(size_t n_args, const mp_obj_t *args) {
    lab_require_ok(lab_mode_js(lab_pin(args[0]), mp_obj_is_true(args[1]), n_args > 2 ? mp_obj_get_int(args[2]) : 0, n_args > 3 ? mp_obj_get_int(args[3]) : -1));
    return mp_const_none;
}
static MP_DEFINE_CONST_FUN_OBJ_VAR_BETWEEN(lab_mode_obj, 2, 4, lab_mode);

static mp_obj_t lab_read(mp_obj_t pin, mp_obj_t pull) {
    return mp_obj_new_int(lab_read_js(lab_pin(pin), mp_obj_get_int(pull)));
}
static MP_DEFINE_CONST_FUN_OBJ_2(lab_read_obj, lab_read);

static mp_obj_t lab_write(mp_obj_t pin, mp_obj_t value) {
    lab_require_ok(lab_write_js(lab_pin(pin), mp_obj_is_true(value)));
    return mp_const_none;
}
static MP_DEFINE_CONST_FUN_OBJ_2(lab_write_obj, lab_write);

static mp_obj_t lab_adc(mp_obj_t pin) {
    return mp_obj_new_int(lab_adc_js(lab_pin(pin)));
}
static MP_DEFINE_CONST_FUN_OBJ_1(lab_adc_obj, lab_adc);
static mp_obj_t lab_pwm(mp_obj_t pin, mp_obj_t freq, mp_obj_t duty) {
    lab_require_ok(lab_pwm_js(lab_pin(pin), mp_obj_get_int(freq), mp_obj_get_int(duty)));
    return mp_const_none;
}
static MP_DEFINE_CONST_FUN_OBJ_3(lab_pwm_obj, lab_pwm);

static mp_obj_t lab_present(mp_obj_t sda, mp_obj_t scl, mp_obj_t addr) {
    return mp_obj_new_bool(lab_i2c_present_js(mp_obj_get_int(sda), mp_obj_get_int(scl), mp_obj_get_int(addr)));
}
static MP_DEFINE_CONST_FUN_OBJ_3(lab_present_obj, lab_present);

static mp_obj_t lab_i2c_write(mp_obj_t data) {
    mp_buffer_info_t buf;
    mp_get_buffer_raise(data, &buf, MP_BUFFER_READ);
    if (buf.len > 4096) mp_raise_ValueError(MP_ERROR_TEXT("I2C transfer exceeds stage 0 limit"));
    lab_i2c_write_js(buf.buf, buf.len);
    return mp_obj_new_int(buf.len);
}
static MP_DEFINE_CONST_FUN_OBJ_1(lab_i2c_write_obj, lab_i2c_write);

static mp_obj_t lab_i2c_byte(mp_obj_t index) {
    return mp_obj_new_int(lab_i2c_byte_js(mp_obj_get_int(index)));
}
static MP_DEFINE_CONST_FUN_OBJ_1(lab_i2c_byte_obj, lab_i2c_byte);

static void lab_bus_check(int result) {
    if (result == -95) mp_raise_msg(&mp_type_NotImplementedError, MP_ERROR_TEXT("Unsupported I2C operation; see circuit diagnostics"));
    if (result < 0) mp_raise_OSError(-result);
}
static mp_obj_t lab_bus_config(size_t n_args, const mp_obj_t *args) {
    int result = lab_bus_config_js(mp_obj_get_int(args[0]), mp_obj_get_int(args[1]), mp_obj_get_int(args[2]), mp_obj_get_int(args[3]));
    lab_bus_check(result); return mp_const_none;
}
static MP_DEFINE_CONST_FUN_OBJ_VAR_BETWEEN(lab_bus_config_obj, 4, 4, lab_bus_config);
static mp_obj_t lab_bus_probe(mp_obj_t id, mp_obj_t addr) {
    return mp_obj_new_bool(lab_bus_probe_js(mp_obj_get_int(id), mp_obj_get_int(addr)));
}
static MP_DEFINE_CONST_FUN_OBJ_2(lab_bus_probe_obj, lab_bus_probe);
static mp_obj_t lab_bus_tx(size_t n_args, const mp_obj_t *args) {
    mp_buffer_info_t buf; mp_get_buffer_raise(args[2], &buf, MP_BUFFER_READ);
    if (buf.len > 4096) mp_raise_ValueError(MP_ERROR_TEXT("I2C limit is 4096 bytes per transaction"));
    int result = lab_bus_tx_js(mp_obj_get_int(args[0]), mp_obj_get_int(args[1]), buf.buf, buf.len, mp_obj_is_true(args[3]));
    lab_bus_check(result); return mp_obj_new_int(result);
}
static MP_DEFINE_CONST_FUN_OBJ_VAR_BETWEEN(lab_bus_tx_obj, 4, 4, lab_bus_tx);
static mp_obj_t lab_bus_rx(size_t n_args, const mp_obj_t *args) {
    int length = mp_obj_get_int(args[2]);
    if (length < 0 || length > 4096) mp_raise_ValueError(MP_ERROR_TEXT("I2C limit is 0-4096 bytes per transaction"));
    vstr_t data; vstr_init_len(&data, length);
    int result = lab_bus_rx_js(mp_obj_get_int(args[0]), mp_obj_get_int(args[1]), (uint8_t *)data.buf, length, mp_obj_is_true(args[3]));
    if (result < 0) { vstr_clear(&data); lab_bus_check(result); }
    return mp_obj_new_bytes_from_vstr(&data);
}
static MP_DEFINE_CONST_FUN_OBJ_VAR_BETWEEN(lab_bus_rx_obj, 4, 4, lab_bus_rx);
static mp_obj_t lab_bus_into(size_t n_args, const mp_obj_t *args) {
    mp_buffer_info_t buf; mp_get_buffer_raise(args[2], &buf, MP_BUFFER_WRITE);
    if (buf.len > 4096) mp_raise_ValueError(MP_ERROR_TEXT("I2C limit is 4096 bytes per transaction"));
    int result = lab_bus_rx_js(mp_obj_get_int(args[0]), mp_obj_get_int(args[1]), buf.buf, buf.len, mp_obj_is_true(args[3]));
    lab_bus_check(result); return mp_const_none;
}
static MP_DEFINE_CONST_FUN_OBJ_VAR_BETWEEN(lab_bus_into_obj, 4, 4, lab_bus_into);

static mp_obj_t lab_frame(mp_obj_t data) {
    mp_buffer_info_t buf;
    mp_get_buffer_raise(data, &buf, MP_BUFFER_READ);
    if (buf.len != 1024) mp_raise_ValueError(MP_ERROR_TEXT("Expected 128x64 MONO_VLSB buffer"));
    lab_frame_js(buf.buf, buf.len);
    return mp_const_none;
}
static MP_DEFINE_CONST_FUN_OBJ_1(lab_frame_obj, lab_frame);

static const mp_rom_map_elem_t lab_globals_table[] = {
    { MP_ROM_QSTR(MP_QSTR___name__), MP_ROM_QSTR(MP_QSTR__lab) },
    { MP_ROM_QSTR(MP_QSTR_spi_config), MP_ROM_PTR(&lab_spi_config_obj) },
    { MP_ROM_QSTR(MP_QSTR_spi_exchange), MP_ROM_PTR(&lab_spi_exchange_obj) },
    { MP_ROM_QSTR(MP_QSTR_pulse_us), MP_ROM_PTR(&lab_pulse_obj) },
    { MP_ROM_QSTR(MP_QSTR_timing), MP_ROM_PTR(&lab_timing_obj) },
    { MP_ROM_QSTR(MP_QSTR_mode), MP_ROM_PTR(&lab_mode_obj) },
    { MP_ROM_QSTR(MP_QSTR_read), MP_ROM_PTR(&lab_read_obj) },
    { MP_ROM_QSTR(MP_QSTR_write), MP_ROM_PTR(&lab_write_obj) },
    { MP_ROM_QSTR(MP_QSTR_adc), MP_ROM_PTR(&lab_adc_obj) },
    { MP_ROM_QSTR(MP_QSTR_pwm), MP_ROM_PTR(&lab_pwm_obj) },
    { MP_ROM_QSTR(MP_QSTR_present), MP_ROM_PTR(&lab_present_obj) },
    { MP_ROM_QSTR(MP_QSTR_i2c_write), MP_ROM_PTR(&lab_i2c_write_obj) },
    { MP_ROM_QSTR(MP_QSTR_i2c_byte), MP_ROM_PTR(&lab_i2c_byte_obj) },
    { MP_ROM_QSTR(MP_QSTR_bus_config), MP_ROM_PTR(&lab_bus_config_obj) },
    { MP_ROM_QSTR(MP_QSTR_bus_probe), MP_ROM_PTR(&lab_bus_probe_obj) },
    { MP_ROM_QSTR(MP_QSTR_bus_tx), MP_ROM_PTR(&lab_bus_tx_obj) },
    { MP_ROM_QSTR(MP_QSTR_bus_rx), MP_ROM_PTR(&lab_bus_rx_obj) },
    { MP_ROM_QSTR(MP_QSTR_bus_into), MP_ROM_PTR(&lab_bus_into_obj) },
    { MP_ROM_QSTR(MP_QSTR_show), MP_ROM_PTR(&lab_frame_obj) },
};
static MP_DEFINE_CONST_DICT(lab_globals, lab_globals_table);
const mp_obj_module_t lab_module = {
    .base = { &mp_type_module },
    .globals = (mp_obj_dict_t *)&lab_globals,
};
MP_REGISTER_MODULE(MP_QSTR__lab, lab_module);
