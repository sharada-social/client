#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
  tauri::Builder::default()
    .setup(|app| {
      if cfg!(debug_assertions) {
        app.handle().plugin(
          tauri_plugin_log::Builder::default()
            .level(log::LevelFilter::Info)
            .build(),
        )?;
      }

      #[cfg(desktop)]
      {
        use tauri::menu::{Menu, MenuItem};
        use tauri::tray::{TrayIconBuilder, TrayIconEvent};
        use tauri::Manager;

        let quit_i = MenuItem::with_id(app, "quit", "Выйти из Sharada", true, None::<&str>)?;
        let show_i = MenuItem::with_id(app, "show", "Открыть", true, None::<&str>)?;
        let menu = Menu::with_items(app, &[&show_i, &quit_i])?;

        let _tray = TrayIconBuilder::new()
          .icon(app.default_window_icon().unwrap().clone())
          .menu(&menu)
          .show_menu_on_left_click(false)
          .on_menu_event(|app, event| match event.id.as_ref() {
            "quit" => {
              app.exit(0);
            }
            "show" => {
              if let Some(win) = app.get_webview_window("main") {
                let _ = win.show();
                let _ = win.set_focus();
              }
            }
            _ => {}
          })
          .on_tray_icon_event(|tray, event| {
            if let TrayIconEvent::Click { button: tauri::tray::MouseButton::Left, .. } = event {
              let app = tray.app_handle();
              if let Some(win) = app.get_webview_window("main") {
                if win.is_visible().unwrap_or(false) {
                  let _ = win.hide();
                } else {
                  let _ = win.show();
                  let _ = win.set_focus();
                }
              }
            }
          })
          .build(app)?;
      }

      Ok(())
    })
    .on_window_event(|window, event| {
      #[cfg(desktop)]
      if let tauri::WindowEvent::CloseRequested { api, .. } = event {
        let _ = window.hide();
        api.prevent_close();
      }
    })
    .run(tauri::generate_context!())
    .expect("error while building tauri application");
}
